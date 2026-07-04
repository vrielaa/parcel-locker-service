import { inject, Injectable } from '@angular/core';

import { LockerCell, ParcelLocker } from '../models/app.models';
import { ApiClient } from './api-client';

@Injectable({
  providedIn: 'root'
})
export class ParcelLockersApi {
  private readonly api = inject(ApiClient);

  citiesResource() {
    return this.api.resource<string[]>(() => '/miasta', [], 'parcel-locker-cities');
  }

  parcelLockersResource(city: () => string) {
    return this.api.resource<ParcelLocker[]>(
      () => {
        const selectedCity = city();
        return selectedCity ? `/automaty?miasto=${encodeURIComponent(selectedCity)}` : undefined;
      },
      [],
      'parcel-lockers-by-city'
    );
  }

  layoutResource(parcelLockerId: () => number) {
    return this.api.resource<LockerCell[]>(
      () => {
        const id = parcelLockerId();
        return id ? `/automaty/${id}` : undefined;
      },
      [],
      'parcel-locker-layout'
    );
  }
}
