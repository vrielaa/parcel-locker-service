import { Component, OnInit, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { ApiClient } from '../../core/api/api-client';
import { FaultyLockerRow, PackageRow, Role, UserRow } from '../../core/models/app.models';
import { formatStatus, packageId, packageTracking, roles } from '../../core/utils/format';

interface NewUserFormModel {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

interface ParcelLockerFormModel {
  code: string;
  address: string;
  city: string;
  gps: string;
  rows: number;
  columns: number;
}

interface DeleteParcelLockerFormModel {
  parcelLockerId: number;
}

function createInitialNewUserForm(): NewUserFormModel {
  return {
    role: 'KLIENT',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  };
}

function createInitialParcelLockerForm(): ParcelLockerFormModel {
  return {
    code: '',
    address: '',
    city: '',
    gps: '',
    rows: 6,
    columns: 4
  };
}

@Component({
  selector: 'app-admin-page',
  imports: [FormField],
  templateUrl: './admin.page.html'
})
export class AdminPage implements OnInit {
  private readonly api = inject(ApiClient);
  protected readonly availableRoles = roles;

  protected readonly tab = signal<'users' | 'lockers'>('users');
  protected readonly users = signal<UserRow[]>([]);
  protected readonly clientPackages = signal<PackageRow[]>([]);
  protected readonly selectedClientId = signal(0);
  protected readonly selectedClientEmail = signal('');
  protected readonly clientPackageMode = signal<'received' | 'sent'>('received');
  protected readonly faultyLockers = signal<FaultyLockerRow[]>([]);
  protected readonly message = signal('');

  protected readonly newUserModel = signal<NewUserFormModel>(createInitialNewUserForm());
  protected readonly newUserForm = form(this.newUserModel);
  protected readonly parcelLockerModel = signal<ParcelLockerFormModel>(createInitialParcelLockerForm());
  protected readonly parcelLockerForm = form(this.parcelLockerModel);
  protected readonly deleteParcelLockerModel = signal<DeleteParcelLockerFormModel>({ parcelLockerId: 0 });
  protected readonly deleteParcelLockerForm = form(this.deleteParcelLockerModel);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;

  async ngOnInit() {
    await Promise.all([this.loadUsers(), this.loadFaultyLockers()]);
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
    const data = this.newUserModel();
    await this.api.post('/admin/users', {
      role: data.role,
      imie: data.firstName.trim(),
      nazwisko: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      telefon: data.phone.trim(),
      password: data.password
    });
    this.message.set('Użytkownik dodany.');
    this.newUserModel.set(createInitialNewUserForm());
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
    const data = this.parcelLockerModel();
    await this.api.post('/admin/automaty', {
      kod: data.code.trim(),
      adres: data.address.trim(),
      miasto: data.city.trim(),
      wspolrzedne: data.gps.trim(),
      liczbaWierszy: data.rows,
      liczbaKolumn: data.columns
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
    const parcelLockerIdValue = Number(this.deleteParcelLockerModel().parcelLockerId);
    if (!parcelLockerIdValue || !confirm(`Usunąć automat #${parcelLockerIdValue}?`)) return;
    await this.api.delete(`/admin/automaty/${parcelLockerIdValue}`);
    this.message.set('Automat usunięty.');
    this.deleteParcelLockerForm.parcelLockerId().value.set(0);
  }
}
