import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { AuthStore } from '../../core/auth/auth.store';
import { ApiOk, PackageEvent, PackageRow, ParcelLocker } from '../../core/models/app.models';
import { apiMessage, formatDate, formatStatus, packageId, packageTracking, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
import { buttonClass, getValue, ghostButtonClass, inputClass, labelClass, numberValue, pageClass, panelClass, statusTone, subtlePanelClass } from '../../shared/page-ui';

@Component({
  selector: 'app-packages-page',
  templateUrl: './packages.page.html'
})
export class PackagesPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthStore);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly subtlePanelClass = subtlePanelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly mode = signal<'list' | 'create'>('list');
  protected readonly packageMode = signal<'received' | 'sent'>('received');
  protected readonly packages = signal<PackageRow[]>([]);
  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly events = signal<PackageEvent[]>([]);
  protected readonly cities = signal<string[]>([]);
  protected readonly createParcelLockers = signal<ParcelLocker[]>([]);
  protected readonly createCity = signal('');
  protected readonly createParcelLockerId = signal(0);
  protected readonly lockerSearch = signal('');
  protected readonly receiverEmail = signal('');
  protected readonly receiverPhone = signal('');
  protected readonly width = signal(8);
  protected readonly height = signal(38);
  protected readonly depth = signal(64);
  protected readonly formMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly statusTone = statusTone;
  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;

  protected readonly filteredPackages = computed(() => {
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return this.packages().filter((pkg) => {
      if (this.packageMode() === 'sent') return Number(pkg.nadawca_id) === clientId;
      return Number(pkg.odbiorca_id) === clientId;
    });
  });

  protected readonly filteredCreateParcelLockers = computed(() => {
    const query = this.lockerSearch().trim().toLowerCase();
    if (!query) return this.createParcelLockers();

    return this.createParcelLockers().filter((locker) =>
      [parcelLockerName(locker), parcelLockerAddress(locker), parcelLockerId(locker)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });

  protected readonly suggestedPackageSize = computed(() => {
    const dims = [this.width(), this.height(), this.depth()].map(Number).sort((a, b) => a - b);
    if (dims.some((dim) => !Number.isFinite(dim) || dim <= 0)) return '-';

    const fits = (limit: number[]) => dims.every((dim, index) => dim <= limit[index]);
    if (fits([8, 20, 30])) return 'S';
    if (fits([20, 40, 40])) return 'M';
    if (fits([40, 60, 60])) return 'L';
    return 'Poza standardem S/M/L';
  });

  async ngOnInit() {
    await Promise.all([this.loadPackages(), this.loadCities()]);
  }

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set(getValue(event));
    this.formMessage.set('');
  }

  protected setNumber(target: WritableSignal<number>, event: Event) {
    target.set(numberValue(getValue(event)));
    this.formMessage.set('');
  }

  protected async loadPackages() {
    const data = await this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/me/paczki');
    this.packages.set(data.paczki || []);
    if (!this.selectedPackage() && this.filteredPackages()[0]) await this.selectPackage(this.filteredPackages()[0]);
  }

  protected async selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
    const id = packageId(pkg);
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; zdarzenia: PackageEvent[] }>(`/paczki/${id}/zdarzenia`);
    this.events.set(data.zdarzenia || []);
  }

  protected canExtendSelected() {
    const pkg = this.selectedPackage();
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return String(pkg?.status || '').toUpperCase() === 'W_AUTOMACIE' && Number(pkg?.odbiorca_id) === clientId;
  }

  protected async extendSelected() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    await this.api.post<ApiOk>(`/paczki/${id}/przedluzenia`, { ile_godzin: 24 });
    await this.loadPackages();
  }

  protected async loadCities() {
    this.cities.set(await this.api.get<string[]>('/miasta'));
  }

  protected async selectCreateCity(event: Event) {
    const city = getValue(event);
    this.createCity.set(city);
    this.createParcelLockerId.set(0);
    this.lockerSearch.set('');
    this.createParcelLockers.set(city ? await this.api.get<ParcelLocker[]>(`/automaty?miasto=${encodeURIComponent(city)}`) : []);
  }

  protected async createPackage(event: Event) {
    event.preventDefault();
    this.formMessage.set('');

    if (!this.receiverEmail().trim() || !this.createParcelLockerId()) {
      this.formMessage.set('Wybierz odbiorcę i automat docelowy.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.api.post('/me/paczki', {
        odbiorca_email: this.receiverEmail().trim().toLowerCase(),
        odbiorca: { telefon: this.receiverPhone().trim() || null },
        automat_id: this.createParcelLockerId(),
        szerokosc_cm: this.width(),
        wysokosc_cm: this.height(),
        glebokosc_cm: this.depth()
      });

      this.formMessage.set('Paczka została nadana i czeka na zatwierdzenie operatora.');
      this.receiverEmail.set('');
      this.receiverPhone.set('');
      await this.loadPackages();
      this.mode.set('list');
      this.packageMode.set('sent');
    } catch (error) {
      this.formMessage.set(apiMessage(error, 'Nie udało się nadać paczki.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
