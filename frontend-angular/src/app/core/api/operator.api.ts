import { inject, Injectable } from '@angular/core';

import { ApiOk, PackageRow } from '../models/app.models';
import { ApiClient } from './api-client';

export interface OperatorPackagesResponse {
  ok: boolean;
  paczki: PackageRow[];
}

export interface DatabaseTestResponse {
  ok: boolean;
  now?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorApi {
  private readonly api = inject(ApiClient);

  pendingPackagesResource() {
    return this.api.resource<OperatorPackagesResponse>(() => '/operator/paczki/pending', { ok: true, paczki: [] }, 'operator-pending-packages');
  }

  approvePackage(packageId: number) {
    return this.api.post<ApiOk>(`/operator/paczki/${packageId}/approve`);
  }

  testDatabase() {
    return this.api.get<DatabaseTestResponse>('/db/test');
  }

  initializeDatabase() {
    return this.api.post<ApiOk>('/db/init');
  }
}
