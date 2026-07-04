import { Component, computed, effect, inject, signal } from '@angular/core';

import { ParcelLockersApi } from '../../core/api/parcel-lockers.api';
import { LockerCell, ParcelLocker } from '../../core/models/app.models';
import { apiMessage, lockerId, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
import { LockerLayoutView } from '../../shared/locker-layout.component';

@Component({
  selector: 'app-parcel-lockers-page',
  imports: [LockerLayoutView],
  templateUrl: './parcel-lockers.page.html'
})
export class ParcelLockersPage {
  protected readonly parcelLockersApi = inject(ParcelLockersApi);

  protected readonly selectedCity = signal('');
  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);

  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;
  protected readonly lockerId = lockerId;

  protected readonly citiesResource = this.parcelLockersApi.citiesResource();
  protected readonly parcelLockersResource = this.parcelLockersApi.parcelLockersResource(this.selectedCity);
  protected readonly layoutResource = this.parcelLockersApi.layoutResource(() => parcelLockerId(this.selectedParcelLocker()));

  protected readonly cities = computed(() => this.citiesResource.hasValue() ? this.citiesResource.value() : []);
  protected readonly parcelLockers = computed<ParcelLocker[]>(() => this.parcelLockersResource.hasValue() ? this.parcelLockersResource.value() : []);
  protected readonly layout = computed<LockerCell[]>(() => this.layoutResource.hasValue() ? this.layoutResource.value() : []);

  protected readonly message = computed(() => {
    if (this.citiesResource.error()) return apiMessage(this.citiesResource.error(), 'Nie udało się pobrać miast.');
    if (this.citiesResource.isLoading()) return 'Ładowanie miast...';
    if (!this.cities().length) return 'Brak miast z automatami.';

    if (!this.selectedCity()) return '';
    if (this.parcelLockersResource.error()) return apiMessage(this.parcelLockersResource.error(), 'Nie udało się pobrać automatów.');
    if (this.parcelLockersResource.isLoading()) return 'Ładowanie automatów...';
    if (!this.parcelLockers().length) return 'Brak automatów w tym mieście.';

    return '';
  });

  constructor() {
    effect(() => {
      const cities = this.cities();
      if (!this.selectedCity() && cities[0]) this.selectCity(cities[0]);
    });
  }

  protected loadCities() {
    this.citiesResource.reload();
  }

  protected selectCity(city: string) {
    this.selectedCity.set(city);
    this.selectedParcelLocker.set(null);
  }

  protected selectParcelLocker(parcelLocker: ParcelLocker) {
    this.selectedParcelLocker.set(parcelLocker);
  }

  protected reloadSelectedLayout() {
    this.layoutResource.reload();
  }

}
