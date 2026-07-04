import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { FaultyLockerRow, PackageRow, Role, UserRow } from '../../core/models/app.models';
import { formatStatus, packageId, packageTracking, roles } from '../../core/utils/format';
import { buttonClass, dangerButtonClass, getValue, ghostButtonClass, inputClass, labelClass, numberValue, pageClass, panelClass } from '../../shared/page-ui';

@Component({
  selector: 'app-admin-page',
  templateUrl: './admin.page.html'
})
export class AdminPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly dangerButtonClass = dangerButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly availableRoles = roles;

  protected readonly tab = signal<'users' | 'lockers'>('users');
  protected readonly users = signal<UserRow[]>([]);
  protected readonly clientPackages = signal<PackageRow[]>([]);
  protected readonly selectedClientId = signal(0);
  protected readonly selectedClientEmail = signal('');
  protected readonly clientPackageMode = signal<'received' | 'sent'>('received');
  protected readonly faultyLockers = signal<FaultyLockerRow[]>([]);
  protected readonly message = signal('');

  protected readonly newUserRole = signal<Role>('KLIENT');
  protected readonly newFirstName = signal('');
  protected readonly newLastName = signal('');
  protected readonly newEmail = signal('');
  protected readonly newPhone = signal('');
  protected readonly newPassword = signal('');

  protected readonly lockerCode = signal('');
  protected readonly lockerAddress = signal('');
  protected readonly lockerCity = signal('');
  protected readonly lockerGps = signal('');
  protected readonly lockerRows = signal(6);
  protected readonly lockerColumns = signal(4);
  protected readonly deleteParcelLockerId = signal(0);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;

  async ngOnInit() {
    await Promise.all([this.loadUsers(), this.loadFaultyLockers()]);
  }

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set(getValue(event));
    this.message.set('');
  }

  protected setNumber(target: WritableSignal<number>, event: Event) {
    target.set(numberValue(getValue(event)));
    this.message.set('');
  }

  protected asRole(event: Event) {
    return getValue(event) as Role;
  }

  protected usersByRole(role: Role) {
    return this.users().filter((user) => user.rola === role);
  }

  protected userLabel(user: UserRow) {
    const first = user.klient_imie || user.pracownik_imie || '';
    const last = user.klient_nazwisko || user.pracownik_nazwisko || '';
    return `${first} ${last}`.trim() || user.email || '-';
  }

  protected async loadUsers() {
    const data = await this.api.get<{ ok: boolean; users: UserRow[] }>('/admin/users');
    this.users.set(data.users || []);
  }

  protected async createUser(event: Event) {
    event.preventDefault();
    await this.api.post('/admin/users', {
      role: this.newUserRole(),
      imie: this.newFirstName().trim(),
      nazwisko: this.newLastName().trim(),
      email: this.newEmail().trim().toLowerCase(),
      telefon: this.newPhone().trim(),
      password: this.newPassword()
    });
    this.message.set('Użytkownik dodany.');
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newEmail.set('');
    this.newPhone.set('');
    this.newPassword.set('');
    await this.loadUsers();
  }

  protected async deleteUser(user: UserRow) {
    if (!user.app_user_id || !confirm(`Usunąć użytkownika ${user.email}?`)) return;
    await this.api.delete(`/admin/users/${user.app_user_id}`);
    this.message.set('Użytkownik usunięty.');
    await this.loadUsers();
  }

  protected async loadClientPackages(user: UserRow) {
    if (!user.klient_id) return;
    this.selectedClientId.set(user.klient_id);
    this.selectedClientEmail.set(user.email || '');
    await this.loadSelectedClientPackages('received');
  }

  protected async loadSelectedClientPackages(mode: 'received' | 'sent') {
    const clientId = this.selectedClientId();
    if (!clientId) return;
    this.clientPackageMode.set(mode);
    const data = await this.api.get<{ ok: boolean; paczki: PackageRow[] }>(`/admin/clients/${clientId}/paczki?mode=${mode}`);
    this.clientPackages.set(data.paczki || []);
  }

  protected async simulatePickup(pkg: PackageRow) {
    const id = packageId(pkg);
    if (!id) return;
    await this.api.post(`/admin/paczki/${id}/simulate-pickup`);
    this.message.set('Odbiór zasymulowany.');
    this.clientPackages.update((rows) => rows.filter((row) => packageId(row) !== id));
  }

  protected async createParcelLocker(event: Event) {
    event.preventDefault();
    await this.api.post('/admin/automaty', {
      kod: this.lockerCode().trim(),
      adres: this.lockerAddress().trim(),
      miasto: this.lockerCity().trim(),
      wspolrzedne: this.lockerGps().trim(),
      liczbaWierszy: this.lockerRows(),
      liczbaKolumn: this.lockerColumns()
    });
    this.message.set('Automat dodany.');
  }

  protected async loadFaultyLockers() {
    const data = await this.api.get<{ ok: boolean; lockers: FaultyLockerRow[] }>('/admin/automaty/locker-faulty');
    this.faultyLockers.set(data.lockers || []);
  }

  protected async repairLocker(row: FaultyLockerRow, lockerIdValue: number) {
    if (!row.automat_id) return;
    await this.api.put(`/admin/automaty/${row.automat_id}/lockers/${lockerIdValue}/mark-repaired`);
    this.message.set(`Skrytka #${lockerIdValue} oznaczona jako naprawiona.`);
    await this.loadFaultyLockers();
  }

  protected async deleteParcelLocker() {
    if (!this.deleteParcelLockerId() || !confirm(`Usunąć automat #${this.deleteParcelLockerId()}?`)) return;
    await this.api.delete(`/admin/automaty/${this.deleteParcelLockerId()}`);
    this.message.set('Automat usunięty.');
    this.deleteParcelLockerId.set(0);
  }
}
