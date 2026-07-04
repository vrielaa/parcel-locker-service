import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { LockerCell, PackageEvent, PackageRow } from '../../core/models/app.models';
import { formatDate, formatStatus, lockerId, packageDimensions, packageId, packageTracking } from '../../core/utils/format';
import { buttonClass, getValue, ghostButtonClass, inputClass, labelClass, pageClass, panelClass, statusTone, subtlePanelClass } from '../../shared/page-ui';

@Component({
  selector: 'app-courier-page',
  templateUrl: './courier.page.html'
})
export class CourierPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly subtlePanelClass = subtlePanelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly pool = signal<PackageRow[]>([]);
  protected readonly mine = signal<PackageRow[]>([]);
  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly events = signal<PackageEvent[]>([]);
  protected readonly destinationLockers = signal<LockerCell[]>([]);
  protected readonly selectedLockerId = signal(0);
  protected readonly courierCityFilter = signal('');
  protected readonly message = signal('');

  protected readonly allPackages = computed(() => [...this.mine(), ...this.pool()]);
  protected readonly courierCities = computed(() => {
    return [...new Set(this.allPackages().map((pkg) => String(pkg.docelowy_automat_miasto || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pl'));
  });
  protected readonly filteredCourierPackages = computed(() => {
    const city = this.courierCityFilter();
    return city ? this.allPackages().filter((pkg) => pkg.docelowy_automat_miasto === city) : this.allPackages();
  });
  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly statusTone = statusTone;
  protected readonly lockerId = lockerId;

  async ngOnInit() {
    await this.load();
  }

  protected async load() {
    const [mine, pool] = await Promise.all([
      this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/kurier/paczki'),
      this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/kurier/paczki/pool')
    ]);

    this.mine.set(mine.paczki || []);
    this.pool.set(pool.paczki || []);
  }

  protected async selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
    this.destinationLockers.set([]);
    this.selectedLockerId.set(0);
    await this.loadEvents();
  }

  protected setCourierCityFilter(event: Event) {
    this.courierCityFilter.set(getValue(event));
    this.selectedPackage.set(null);
    this.destinationLockers.set([]);
    this.selectedLockerId.set(0);
  }

  protected canStartTransport() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'NADANA';
  }

  protected canPlaceInLocker() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'W_DRODZE';
  }

  protected async startTransport() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    await this.api.post(`/kurier/paczki/${id}/podejmij`);
    this.message.set('Transport rozpoczęty.');
    await this.load();
    const updated = this.allPackages().find((pkg) => packageId(pkg) === id);
    if (updated) await this.selectPackage(updated);
  }

  protected async loadDestinationLockers() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; skrytki: LockerCell[] }>(`/kurier/paczki/${id}/skrytki-docelowe`);
    this.destinationLockers.set(data.skrytki || []);
    this.message.set(data.skrytki?.length ? '' : 'Brak wolnych skrytek pasujących do paczki.');
  }

  protected async placeInLocker() {
    const id = packageId(this.selectedPackage());
    if (!id || !this.selectedLockerId()) return;
    await this.api.post(`/kurier/paczki/${id}/umiesc-w-automacie`, { skrytka_id: this.selectedLockerId() });
    this.message.set('Paczka została umieszczona w automacie.');
    await this.load();
    const updated = this.allPackages().find((pkg) => packageId(pkg) === id);
    if (updated) await this.selectPackage(updated);
  }

  private async loadEvents() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; zdarzenia: PackageEvent[] }>(`/paczki/${id}/zdarzenia`);
    this.events.set(data.zdarzenia || []);
  }
}
