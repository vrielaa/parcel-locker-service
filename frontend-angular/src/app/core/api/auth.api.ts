import { inject, Injectable } from '@angular/core';

import { AuthResponse, MeResponse } from '../models/app.models';
import { ApiClient } from './api-client';

export interface RegisterPayload {
  imie: string;
  nazwisko: string;
  email: string;
  telefon: string | null;
  password: string;
  password2: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApi {
  private readonly api = inject(ApiClient);

  me() {
    return this.api.get<MeResponse>('/auth/me');
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password });
  }

  register(payload: RegisterPayload) {
    return this.api.post<AuthResponse>('/auth/register', payload);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.post<{ ok: boolean }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }
}
