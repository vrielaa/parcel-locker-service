import { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { ChangePasswordPage, LoginPage, RegisterPage } from './pages/auth/auth.pages';
import { AdminPage } from './pages/admin/admin.page';
import { CourierPage } from './pages/courier/courier.page';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { OperatorPage } from './pages/operator/operator.page';
import { PackagesPage } from './pages/packages/packages.page';
import { ParcelLockersPage } from './pages/parcel-lockers/parcel-lockers.page';
import { ReportsPage } from './pages/reports/reports.page';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
    title: 'Logowanie'
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [guestGuard],
    title: 'Rejestracja'
  },
  {
    path: 'change-password',
    component: ChangePasswordPage,
    canActivate: [authGuard],
    title: 'Zmiana hasła'
  },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [authGuard],
    title: 'Parcel Locker 2.0'
  },
  {
    path: 'parcel-lockers',
    component: ParcelLockersPage,
    canActivate: [authGuard, roleGuard],
    title: 'Parcel lockers',
    data: {
      roles: ['ADMIN', 'OPERATOR', 'KURIER']
    }
  },
  {
    path: 'packages',
    component: PackagesPage,
    canActivate: [authGuard, roleGuard],
    title: 'Packages',
    data: {
      roles: ['KLIENT']
    }
  },
  {
    path: 'courier',
    component: CourierPage,
    canActivate: [authGuard, roleGuard],
    title: 'Courier',
    data: {
      roles: ['KURIER']
    }
  },
  {
    path: 'operator',
    component: OperatorPage,
    canActivate: [authGuard, roleGuard],
    title: 'Operator',
    data: {
      roles: ['ADMIN', 'OPERATOR']
    }
  },
  {
    path: 'admin',
    component: AdminPage,
    canActivate: [authGuard, roleGuard],
    title: 'Admin',
    data: {
      roles: ['ADMIN']
    }
  },
  {
    path: 'reports',
    component: ReportsPage,
    canActivate: [authGuard, roleGuard],
    title: 'Reports',
    data: {
      roles: ['ADMIN', 'OPERATOR', 'KURIER']
    }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
