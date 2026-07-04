import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { CourierApi } from '../../core/api/courier.api';
import { LockerCell, PackageEvent, PackageRow } from '../../core/models/app.models';
import { apiMessage, formatDate, formatStatus, lockerId, packageDimensions, packageId, packageTracking } from '../../core/utils/format';

interface CourierFilterFormModel {
  city: string;
}

@Component({
  selector: 'app-courier-page',
  imports: [FormField],
  templateUrl: './courier.page.html'
})
export class CourierPage {
  private readonly courierApi = inject(CourierApi);

  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly destinationPackageId = signal(0);
  protected readonly selectedLockerId = signal(0);
  protected readonly courierFilterModel = signal<CourierFilterFormModel>({ city: '' });
  protected readonly courierFilterForm = form(this.courierFilterModel);
  protected readonly message = signal('');

  protected readonly mineResource = this.courierApi.myPackagesResource();
  protected readonly poolResource = this.courierApi.poolPackagesResource();
  protected readonly eventsResource = this.courierApi.packageEventsResource(() => packageId(this.selectedPackage()));
  protected readonly destinationLockersResource = this.courierApi.destinationLockersResource(this.destinationPackageId);

  protected readonly mine = computed<PackageRow[]>(() => this.mineResource.hasValue() ? this.mineResource.value().paczki || [] : []);
  protected readonly pool = computed<PackageRow[]>(() => this.poolResource.hasValue() ? this.poolResource.value().paczki || [] : []);
  protected readonly events = computed<PackageEvent[]>(() => this.eventsResource.hasValue() ? this.eventsResource.value().zdarzenia || [] : []);
  protected readonly destinationLockers = computed<LockerCell[]>(() => this.destinationLockersResource.hasValue() ? this.destinationLockersResource.value().skrytki || [] : []);

  protected readonly allPackages = computed(() => [...this.mine(), ...this.pool()]);
  protected readonly courierCities = computed(() => {
    return [...new Set(this.allPackages().map((pkg) => String(pkg.docelowy_automat_miasto || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pl'));
  });
  protected readonly filteredCourierPackages = computed(() => {
    const city = this.courierFilterModel().city;
    return city ? this.allPackages().filter((pkg) => pkg.docelowy_automat_miasto === city) : this.allPackages();
  });
  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly lockerId = lockerId;

  constructor() {
    effect(() => {
      const selectedId = packageId(this.selectedPackage());
      if (!selectedId) return;

      const updated = this.allPackages().find((pkg) => packageId(pkg) === selectedId);
      if (updated && updated !== this.selectedPackage()) this.selectedPackage.set(updated);
    });

    effect(() => {
      if (!this.destinationPackageId()) return;
      if (this.destinationLockersResource.error()) {
        this.message.set(apiMessage(this.destinationLockersResource.error(), 'Nie udało się pobrać wolnych skrytek.'));
        return;
      }
      if (this.destinationLockersResource.hasValue()) {
        this.message.set(this.destinationLockers().length ? '' : 'Brak wolnych skrytek pasujących do paczki.');
      }
    });
  }

  protected load() {
    this.mineResource.reload();
    this.poolResource.reload();
  }

  protected selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
    this.destinationPackageId.set(0);
    this.selectedLockerId.set(0);
  }

  protected setCourierCityFilter() {
    this.selectedPackage.set(null);
    this.destinationPackageId.set(0);
    this.selectedLockerId.set(0);
  }

  protected clearCourierCityFilter() {
    this.courierFilterForm.city().value.set('');
    this.setCourierCityFilter();
  }

  protected canStartTransport() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'NADANA';
  }

  protected canPlaceInLocker() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'W_DRODZE';
  }

  protected startTransport() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    this.courierApi.startTransport(id).subscribe({
      next: () => {
        this.message.set('Transport rozpoczęty.');
        this.load();
        this.eventsResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się rozpocząć transportu.'))
    });
  }

  protected loadDestinationLockers() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    this.destinationPackageId.set(id);
    this.destinationLockersResource.reload();
  }

  protected placeInLocker() {
    const id = packageId(this.selectedPackage());
    if (!id || !this.selectedLockerId()) return;
    this.courierApi.placeInLocker(id, this.selectedLockerId()).subscribe({
      next: () => {
        this.message.set('Paczka została umieszczona w automacie.');
        this.destinationPackageId.set(0);
        this.selectedLockerId.set(0);
        this.load();
        this.eventsResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się umieścić paczki w automacie.'))
    });
  }
}
