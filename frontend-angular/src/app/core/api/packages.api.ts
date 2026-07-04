import { inject, Injectable } from '@angular/core';

import { ApiOk, PackageEvent, PackageRow, ParcelLocker } from '../models/app.models';
import { ApiClient } from './api-client';

export interface PackageListResponse {
  ok: boolean;
  paczki: PackageRow[];
}

export interface PackageEventsResponse {
  ok: boolean;
  zdarzenia: PackageEvent[];
}

export interface CreatePackagePayload {
  odbiorca_email: string;
  odbiorca: {
    telefon: string | null;
  };
  automat_id: number;
  szerokosc_cm: number;
  wysokosc_cm: number;
  glebokosc_cm: number;
}

@Injectable({
  providedIn: 'root'
})
export class PackagesApi {
  private readonly api = inject(ApiClient);

  myPackagesResource() {
    return this.api.resource<PackageListResponse>(() => '/me/paczki', { ok: true, paczki: [] }, 'my-packages');
  }

  packageEventsResource(packageId: () => number) {
    return this.api.resource<PackageEventsResponse>(
      () => {
        const id = packageId();
        return id ? `/paczki/${id}/zdarzenia` : undefined;
      },
      { ok: true, zdarzenia: [] },
      'package-events'
    );
  }

  citiesResource() {
    return this.api.resource<string[]>(() => '/miasta', [], 'package-form-cities');
  }

  parcelLockersResource(city: () => string) {
    return this.api.resource<ParcelLocker[]>(
      () => {
        const selectedCity = city();
        return selectedCity ? `/automaty?miasto=${encodeURIComponent(selectedCity)}` : undefined;
      },
      [],
      'package-form-parcel-lockers'
    );
  }

  extendPickup(packageId: number, hours = 24) {
    return this.api.post<ApiOk>(`/paczki/${packageId}/przedluzenia`, { ile_godzin: hours });
  }

  createPackage(payload: CreatePackagePayload) {
    return this.api.post<ApiOk>('/me/paczki', payload);
  }
}
