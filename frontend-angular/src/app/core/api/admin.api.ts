import { inject, Injectable } from '@angular/core';

import { ApiOk, FaultyLockerRow, PackageRow, Role, UserRow } from '../models/app.models';
import { ApiClient } from './api-client';

export interface AdminUsersResponse {
  ok: boolean;
  users: UserRow[];
}

export interface AdminClientPackagesResponse {
  ok: boolean;
  paczki: PackageRow[];
}

export interface AdminFaultyLockersResponse {
  ok: boolean;
  lockers: FaultyLockerRow[];
}

export interface CreateUserPayload {
  role: Role;
  imie: string;
  nazwisko: string;
  email: string;
  telefon: string;
  password: string;
}

export interface CreateParcelLockerPayload {
  kod: string;
  adres: string;
  miasto: string;
  wspolrzedne: string;
  liczbaWierszy: number;
  liczbaKolumn: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminApi {
  private readonly api = inject(ApiClient);

  usersResource() {
    return this.api.resource<AdminUsersResponse>(() => '/admin/users', { ok: true, users: [] }, 'admin-users');
  }

  clientPackagesResource(clientId: () => number, mode: () => 'received' | 'sent') {
    return this.api.resource<AdminClientPackagesResponse>(
      () => {
        const id = clientId();
        return id ? `/admin/clients/${id}/paczki?mode=${mode()}` : undefined;
      },
      { ok: true, paczki: [] },
      'admin-client-packages'
    );
  }

  faultyLockersResource() {
    return this.api.resource<AdminFaultyLockersResponse>(
      () => '/admin/automaty/locker-faulty',
      { ok: true, lockers: [] },
      'admin-faulty-lockers'
    );
  }

  createUser(payload: CreateUserPayload) {
    return this.api.post<ApiOk>('/admin/users', payload);
  }

  deleteUser(userId: number) {
    return this.api.delete<ApiOk>(`/admin/users/${userId}`);
  }

  simulatePickup(packageId: number) {
    return this.api.post<ApiOk>(`/admin/paczki/${packageId}/simulate-pickup`);
  }

  createParcelLocker(payload: CreateParcelLockerPayload) {
    return this.api.post<ApiOk>('/admin/automaty', payload);
  }

  repairLocker(parcelLockerId: number, lockerId: number) {
    return this.api.put<ApiOk>(`/admin/automaty/${parcelLockerId}/lockers/${lockerId}/mark-repaired`);
  }

  deleteParcelLocker(parcelLockerId: number) {
    return this.api.delete<ApiOk>(`/admin/automaty/${parcelLockerId}`);
  }
}
