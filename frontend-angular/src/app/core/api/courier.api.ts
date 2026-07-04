import { inject, Injectable } from '@angular/core';

import { ApiOk, LockerCell, PackageEvent, PackageRow } from '../models/app.models';
import { ApiClient } from './api-client';

export interface CourierPackagesResponse {
  ok: boolean;
  paczki: PackageRow[];
}

export interface CourierLockersResponse {
  ok: boolean;
  skrytki: LockerCell[];
}

export interface PackageEventsResponse {
  ok: boolean;
  zdarzenia: PackageEvent[];
}

@Injectable({
  providedIn: 'root'
})
export class CourierApi {
  private readonly api = inject(ApiClient);

  myPackagesResource() {
    return this.api.resource<CourierPackagesResponse>(() => '/kurier/paczki', { ok: true, paczki: [] }, 'courier-my-packages');
  }

  poolPackagesResource() {
    return this.api.resource<CourierPackagesResponse>(() => '/kurier/paczki/pool', { ok: true, paczki: [] }, 'courier-pool-packages');
  }

  packageEventsResource(packageId: () => number) {
    return this.api.resource<PackageEventsResponse>(
      () => {
        const id = packageId();
        return id ? `/paczki/${id}/zdarzenia` : undefined;
      },
      { ok: true, zdarzenia: [] },
      'courier-package-events'
    );
  }

  destinationLockersResource(packageId: () => number) {
    return this.api.resource<CourierLockersResponse>(
      () => {
        const id = packageId();
        return id ? `/kurier/paczki/${id}/skrytki-docelowe` : undefined;
      },
      { ok: true, skrytki: [] },
      'courier-destination-lockers'
    );
  }

  startTransport(packageId: number) {
    return this.api.post<ApiOk>(`/kurier/paczki/${packageId}/podejmij`);
  }

  placeInLocker(packageId: number, lockerId: number) {
    return this.api.post<ApiOk>(`/kurier/paczki/${packageId}/umiesc-w-automacie`, { skrytka_id: lockerId });
  }

  markLockerDamaged(lockerId: number, description: string) {
    return this.api.put<ApiOk>(`/kurier/skrytki/${lockerId}/status`, { opis: description });
  }
}
