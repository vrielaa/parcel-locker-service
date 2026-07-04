import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormField, form, min, validate } from '@angular/forms/signals';

import { PackagesApi } from '../../core/api/packages.api';
import { AuthStore } from '../../core/auth/auth.store';
import { PackageEvent, PackageRow, ParcelLocker } from '../../core/models/app.models';
import { apiMessage, formatDate, formatStatus, packageId, packageTracking, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';

interface PackageFormModel {
  receiverEmail: string;
  receiverPhone: string;
  createCity: string;
  createParcelLockerId: string;
  lockerSearch: string;
  width: number;
  height: number;
  depth: number;
}

const LOCKER_SIZE_LIMITS = {
  S: [8, 20, 30],
  M: [20, 40, 40],
  L: [40, 60, 60]
} as const;

const packageTooLargeMessage = 'Wymiary paczki przekraczają największą skrytkę. Maksymalny rozmiar to 40 x 60 x 60 cm po obróceniu paczki.';

function createInitialPackageForm(): PackageFormModel {
  return {
    receiverEmail: '',
    receiverPhone: '',
    createCity: '',
    createParcelLockerId: '',
    lockerSearch: '',
    width: 8,
    height: 38,
    depth: 64
  };
}

function sortedDimensions(data: Pick<PackageFormModel, 'width' | 'height' | 'depth'>) {
  return [data.width, data.height, data.depth].map(Number).sort((a, b) => a - b);
}

function dimensionsFit(limit: readonly number[], dimensions: readonly number[]) {
  return dimensions.every((dim, index) => Number.isFinite(dim) && dim > 0 && dim <= limit[index]);
}

function packageFitsAnyLocker(data: Pick<PackageFormModel, 'width' | 'height' | 'depth'>) {
  const dimensions = sortedDimensions(data);
  return dimensionsFit(LOCKER_SIZE_LIMITS.L, dimensions);
}

function suggestedPackageSize(data: Pick<PackageFormModel, 'width' | 'height' | 'depth'>) {
  const dimensions = sortedDimensions(data);
  if (dimensions.some((dim) => !Number.isFinite(dim) || dim <= 0)) return '-';

  if (dimensionsFit(LOCKER_SIZE_LIMITS.S, dimensions)) return 'S';
  if (dimensionsFit(LOCKER_SIZE_LIMITS.M, dimensions)) return 'M';
  if (dimensionsFit(LOCKER_SIZE_LIMITS.L, dimensions)) return 'L';
  return 'Nie mieści się w żadnej skrytce';
}

@Component({
  selector: 'app-packages-page',
  imports: [FormField],
  templateUrl: './packages.page.html'
})
export class PackagesPage {
  private readonly packagesApi = inject(PackagesApi);
  private readonly auth = inject(AuthStore);

  protected readonly mode = signal<'list' | 'create'>('list');
  protected readonly packageMode = signal<'received' | 'sent'>('received');
  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly packageModel = signal<PackageFormModel>(createInitialPackageForm());
  protected readonly packageForm = form(this.packageModel, (schemaPath) => {
    min(schemaPath.width, 1);
    min(schemaPath.height, 1);
    min(schemaPath.depth, 1);
    validate(schemaPath, ({ value }) => {
      return packageFitsAnyLocker(value())
        ? undefined
        : { kind: 'package-too-large', message: packageTooLargeMessage };
    });
  });
  protected readonly formMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;

  protected readonly packagesResource = this.packagesApi.myPackagesResource();
  protected readonly eventsResource = this.packagesApi.packageEventsResource(() => packageId(this.selectedPackage()));
  protected readonly citiesResource = this.packagesApi.citiesResource();
  protected readonly createParcelLockersResource = this.packagesApi.parcelLockersResource(() => this.packageModel().createCity);

  protected readonly packages = computed<PackageRow[]>(() => this.packagesResource.hasValue() ? this.packagesResource.value().paczki || [] : []);
  protected readonly events = computed<PackageEvent[]>(() => this.eventsResource.hasValue() ? this.eventsResource.value().zdarzenia || [] : []);
  protected readonly cities = computed<string[]>(() => this.citiesResource.hasValue() ? this.citiesResource.value() : []);
  protected readonly createParcelLockers = computed<ParcelLocker[]>(() => this.createParcelLockersResource.hasValue() ? this.createParcelLockersResource.value() : []);

  protected readonly filteredPackages = computed(() => {
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return this.packages().filter((pkg) => {
      if (this.packageMode() === 'sent') return Number(pkg.nadawca_id) === clientId;
      return Number(pkg.odbiorca_id) === clientId;
    });
  });

  protected readonly filteredCreateParcelLockers = computed(() => {
    const query = this.packageModel().lockerSearch.trim().toLowerCase();
    if (!query) return this.createParcelLockers();

    return this.createParcelLockers().filter((locker) =>
      [parcelLockerName(locker), parcelLockerAddress(locker), parcelLockerId(locker)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });

  protected readonly suggestedPackageSize = computed(() => {
    return suggestedPackageSize(this.packageModel());
  });

  protected readonly packageDimensionsError = computed(() => {
    const data = this.packageModel();
    const dimensions = sortedDimensions(data);
    if (dimensions.some((dim) => !Number.isFinite(dim) || dim <= 0)) return '';
    return packageFitsAnyLocker(data) ? '' : packageTooLargeMessage;
  });

  constructor() {
    effect(() => {
      if (!this.selectedPackage() && this.filteredPackages()[0]) this.selectPackage(this.filteredPackages()[0]);
    });
  }

  protected loadPackages() {
    this.packagesResource.reload();
    this.eventsResource.reload();
  }

  protected selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
  }

  protected canExtendSelected() {
    const pkg = this.selectedPackage();
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return String(pkg?.status || '').toUpperCase() === 'W_AUTOMACIE' && Number(pkg?.odbiorca_id) === clientId;
  }

  protected extendSelected() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    this.packagesApi.extendPickup(id).subscribe({
      next: () => {
        this.packagesResource.reload();
        this.eventsResource.reload();
      },
      error: (error) => this.formMessage.set(apiMessage(error, 'Nie udało się przedłużyć odbioru.'))
    });
  }

  protected selectCreateCity() {
    this.packageForm.createParcelLockerId().value.set('');
    this.packageForm.lockerSearch().value.set('');
  }

  protected createPackage(event: Event) {
    event.preventDefault();
    this.formMessage.set('');
    const data = this.packageModel();
    const parcelLockerIdValue = Number(data.createParcelLockerId);

    if (!data.receiverEmail.trim() || !parcelLockerIdValue) {
      this.formMessage.set('Wybierz odbiorcę i automat docelowy.');
      return;
    }

    if (this.packageForm().invalid()) {
      this.formMessage.set(this.packageDimensionsError() || 'Popraw dane paczki przed nadaniem.');
      return;
    }

    this.submitting.set(true);
    this.packagesApi.createPackage({
      odbiorca_email: data.receiverEmail.trim().toLowerCase(),
      odbiorca: { telefon: data.receiverPhone.trim() || null },
      automat_id: parcelLockerIdValue,
      szerokosc_cm: data.width,
      wysokosc_cm: data.height,
      glebokosc_cm: data.depth
    }).subscribe({
      next: () => {
        this.formMessage.set('Paczka została nadana i czeka na zatwierdzenie operatora.');
        this.packageModel.update((current) => ({
          ...current,
          receiverEmail: '',
          receiverPhone: ''
        }));
        this.packagesResource.reload();
        this.mode.set('list');
        this.packageMode.set('sent');
        this.submitting.set(false);
      },
      error: (error) => {
        this.formMessage.set(apiMessage(error, 'Nie udało się nadać paczki.'));
        this.submitting.set(false);
      }
    });
  }
}
