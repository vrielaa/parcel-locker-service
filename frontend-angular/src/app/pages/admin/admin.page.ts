import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { AdminApi } from '../../core/api/admin.api';
import { FaultyLockerRow, PackageRow, Role, UserRow } from '../../core/models/app.models';
import { apiMessage, formatStatus, packageId, packageTracking, roles } from '../../core/utils/format';

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
export class AdminPage {
  private readonly adminApi = inject(AdminApi);
  protected readonly availableRoles = roles;

  protected readonly tab = signal<'users' | 'lockers'>('users');
  protected readonly selectedClientId = signal(0);
  protected readonly selectedClientEmail = signal('');
  protected readonly clientPackageMode = signal<'received' | 'sent'>('received');
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

  protected readonly usersResource = this.adminApi.usersResource();
  protected readonly clientPackagesResource = this.adminApi.clientPackagesResource(this.selectedClientId, this.clientPackageMode);
  protected readonly faultyLockersResource = this.adminApi.faultyLockersResource();

  protected readonly users = computed<UserRow[]>(() => this.usersResource.hasValue() ? this.usersResource.value().users || [] : []);
  protected readonly clientPackages = computed<PackageRow[]>(() => this.clientPackagesResource.hasValue() ? this.clientPackagesResource.value().paczki || [] : []);
  protected readonly faultyLockers = computed<FaultyLockerRow[]>(() => this.faultyLockersResource.hasValue() ? this.faultyLockersResource.value().lockers || [] : []);

  protected usersByRole(role: Role) {
    return this.users().filter((user) => user.rola === role);
  }

  protected userLabel(user: UserRow) {
    const first = user.klient_imie || user.pracownik_imie || '';
    const last = user.klient_nazwisko || user.pracownik_nazwisko || '';
    return `${first} ${last}`.trim() || user.email || '-';
  }

  protected loadUsers() {
    this.usersResource.reload();
  }

  protected createUser(event: Event) {
    event.preventDefault();
    const data = this.newUserModel();
    this.adminApi.createUser({
      role: data.role,
      imie: data.firstName.trim(),
      nazwisko: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      telefon: data.phone.trim(),
      password: data.password
    }).subscribe({
      next: () => {
        this.message.set('Użytkownik dodany.');
        this.newUserModel.set(createInitialNewUserForm());
        this.usersResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się dodać użytkownika.'))
    });
  }

  protected deleteUser(user: UserRow) {
    if (!user.app_user_id || !confirm(`Usunąć użytkownika ${user.email}?`)) return;
    this.adminApi.deleteUser(user.app_user_id).subscribe({
      next: () => {
        this.message.set('Użytkownik usunięty.');
        this.usersResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się usunąć użytkownika.'))
    });
  }

  protected loadClientPackages(user: UserRow) {
    if (!user.klient_id) return;
    this.selectedClientId.set(user.klient_id);
    this.selectedClientEmail.set(user.email || '');
    this.loadSelectedClientPackages('received');
  }

  protected loadSelectedClientPackages(mode: 'received' | 'sent') {
    const clientId = this.selectedClientId();
    if (!clientId) return;
    this.clientPackageMode.set(mode);
  }

  protected simulatePickup(pkg: PackageRow) {
    const id = packageId(pkg);
    if (!id) return;
    this.adminApi.simulatePickup(id).subscribe({
      next: () => {
        this.message.set('Odbiór zasymulowany.');
        this.clientPackagesResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się zasymulować odbioru.'))
    });
  }

  protected createParcelLocker(event: Event) {
    event.preventDefault();
    const data = this.parcelLockerModel();
    this.adminApi.createParcelLocker({
      kod: data.code.trim(),
      adres: data.address.trim(),
      miasto: data.city.trim(),
      wspolrzedne: data.gps.trim(),
      liczbaWierszy: data.rows,
      liczbaKolumn: data.columns
    }).subscribe({
      next: () => {
        this.message.set('Automat dodany.');
        this.parcelLockerModel.set(createInitialParcelLockerForm());
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się dodać automatu.'))
    });
  }

  protected loadFaultyLockers() {
    this.faultyLockersResource.reload();
  }

  protected repairLocker(row: FaultyLockerRow, lockerIdValue: number) {
    if (!row.automat_id) return;
    this.adminApi.repairLocker(row.automat_id, lockerIdValue).subscribe({
      next: () => {
        this.message.set(`Skrytka #${lockerIdValue} oznaczona jako naprawiona.`);
        this.faultyLockersResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się oznaczyć skrytki jako naprawionej.'))
    });
  }

  protected deleteParcelLocker() {
    const parcelLockerIdValue = Number(this.deleteParcelLockerModel().parcelLockerId);
    if (!parcelLockerIdValue || !confirm(`Usunąć automat #${parcelLockerIdValue}?`)) return;
    this.adminApi.deleteParcelLocker(parcelLockerIdValue).subscribe({
      next: () => {
        this.message.set('Automat usunięty.');
        this.deleteParcelLockerForm.parcelLockerId().value.set(0);
        this.faultyLockersResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się usunąć automatu.'))
    });
  }
}
