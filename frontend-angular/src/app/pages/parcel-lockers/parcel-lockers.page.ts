import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { LockerCell, ParcelLocker } from '../../core/models/app.models';
import { apiMessage, lockerId, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
import { ghostButtonClass, pageClass, panelClass } from '../../shared/page-ui';
import { LockerLayoutView } from '../../shared/locker-layout.component';

@Component({
  selector: 'app-parcel-lockers-page',
  imports: [LockerLayoutView],
  templateUrl: './parcel-lockers.page.html'
})
export class ParcelLockersPage implements OnInit {
  protected readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly listButtonClass = 'min-h-10 rounded-lg border border-line bg-surface px-3 text-left text-sm font-semibold text-muted hover:border-brand hover:text-brand-strong';
  protected readonly activeListButtonClass = 'min-h-10 rounded-lg border border-brand bg-brand-soft px-3 text-left text-sm font-bold text-brand-strong';
  protected readonly cardButtonClass = 'grid min-h-32 gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand hover:shadow-card';

  protected readonly cities = signal<string[]>([]);
  protected readonly selectedCity = signal('');
  protected readonly parcelLockers = signal<ParcelLocker[]>([]);
  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);
  protected readonly layout = signal<LockerCell[]>([]);
  protected readonly message = signal('');

  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;
  protected readonly lockerId = lockerId;

  async ngOnInit() {
    await this.loadCities();
  }

  protected async loadCities() {
    this.message.set('Ładowanie miast...');
    try {
      const cities = await this.api.get<string[]>('/miasta');
      this.cities.set(cities);
      this.message.set(cities.length ? '' : 'Brak miast z automatami.');
      if (!this.selectedCity() && cities[0]) await this.selectCity(cities[0]);
    } catch (error) {
      this.message.set(apiMessage(error, 'Nie udało się pobrać miast.'));
    }
  }

  protected async selectCity(city: string) {
    this.selectedCity.set(city);
    this.selectedParcelLocker.set(null);
    this.layout.set([]);
    this.message.set('Ładowanie automatów...');

    try {
      const lockers = await this.api.get<ParcelLocker[]>(`/automaty?miasto=${encodeURIComponent(city)}`);
      this.parcelLockers.set(lockers);
      this.message.set(lockers.length ? '' : 'Brak automatów w tym mieście.');
    } catch (error) {
      this.parcelLockers.set([]);
      this.message.set(apiMessage(error, 'Nie udało się pobrać automatów.'));
    }
  }

  protected async selectParcelLocker(parcelLocker: ParcelLocker) {
    this.selectedParcelLocker.set(parcelLocker);
    await this.reloadSelectedLayout();
  }

  protected async reloadSelectedLayout() {
    const id = parcelLockerId(this.selectedParcelLocker());
    if (!id) return;

    try {
      const layout = await this.api.get<LockerCell[]>(`/automaty/${id}`);
      this.layout.set(layout);
    } catch (error) {
      this.layout.set([]);
      this.message.set(apiMessage(error, 'Nie udało się pobrać skrytek.'));
    }
  }

}
