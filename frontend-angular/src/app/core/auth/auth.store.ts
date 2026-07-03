import { computed, inject, Injectable, signal } from '@angular/core';

import { ApiClient } from '../api/api-client';
import { AppUser, AuthResponse, MeResponse, Role } from '../models/app.models';
import { normalizeRole } from '../utils/format';

const TOKEN_KEY = 'token';
const ROLE_KEY = 'rola';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private readonly api = inject(ApiClient);

  readonly user = signal<AppUser | null>(null);
  readonly loading = signal(false);
  readonly message = signal('');

  readonly role = computed(() => normalizeRole(this.user()?.role || this.user()?.rola || localStorage.getItem(ROLE_KEY)));
  readonly isAuthenticated = computed(() => !!this.user());

  get token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async ensureUser() {
    if (this.user()) return this.user();
    if (!this.token) return null;

    this.loading.set(true);
    try {
      const data = await this.api.get<MeResponse>('/auth/me');
      if (!data?.ok || !data.user) {
        this.clearSession();
        return null;
      }

      this.setUser(data.user);
      return this.user();
    } catch {
      this.clearSession();
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async login(email: string, password: string) {
    const data = await this.api.post<AuthResponse>('/auth/login', { email, password });
    this.applyAuth(data);
    await this.ensureUser();
    return data;
  }

  async register(payload: {
    imie: string;
    nazwisko: string;
    email: string;
    telefon: string | null;
    password: string;
    password2: string;
  }) {
    const data = await this.api.post<AuthResponse>('/auth/register', payload);
    this.applyAuth(data);
    await this.ensureUser();
    return data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await this.api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    });

    const current = this.user();
    if (current) this.setUser({ ...current, must_change_password: false });
  }

  logout() {
    this.clearSession();
  }

  hasAnyRole(allowedRoles: readonly Role[]) {
    const role = this.role();
    return !!role && allowedRoles.includes(role);
  }

  private applyAuth(data: AuthResponse) {
    if (!data?.ok || !data.token) throw new Error('Brak tokena w odpowiedzi logowania.');

    localStorage.setItem(TOKEN_KEY, data.token);

    const role = normalizeRole(data.role || data.rola);
    if (role) localStorage.setItem(ROLE_KEY, role);
  }

  private setUser(user: AppUser) {
    const role = normalizeRole(user.role || user.rola);
    this.user.set({ ...user, role: role ?? undefined, rola: role ?? undefined });
    if (role) localStorage.setItem(ROLE_KEY, role);
  }

  private clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem('access_token');
    localStorage.removeItem('klient_id');
    localStorage.removeItem('klientId');
    localStorage.removeItem('userId');
    this.user.set(null);
  }
}
