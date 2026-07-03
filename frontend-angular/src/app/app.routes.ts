import { Routes } from '@angular/router';

import { FeaturePlaceholder } from './pages/feature-placeholder/feature-placeholder';
import { MigrationDashboard } from './pages/migration-dashboard/migration-dashboard';

export const routes: Routes = [
  {
    path: '',
    component: MigrationDashboard,
    title: 'Parcel Locker 2.0'
  },
  {
    path: 'login',
    component: FeaturePlaceholder,
    title: 'Auth',
    data: {
      area: 'Auth',
      title: 'Authentication',
      status: 'Next',
      endpoints: ['/api/auth/login', '/api/auth/me', '/api/auth/register']
    }
  },
  {
    path: 'parcel-lockers',
    component: FeaturePlaceholder,
    title: 'Parcel lockers',
    data: {
      area: 'Core',
      title: 'Parcel lockers',
      status: 'Planned',
      endpoints: ['/api/automaty', '/api/miasta']
    }
  },
  {
    path: 'packages',
    component: FeaturePlaceholder,
    title: 'Packages',
    data: {
      area: 'Client',
      title: 'Packages',
      status: 'Planned',
      endpoints: ['/api/paczki']
    }
  },
  {
    path: 'courier',
    component: FeaturePlaceholder,
    title: 'Courier',
    data: {
      area: 'Courier',
      title: 'Courier operations',
      status: 'Planned',
      endpoints: ['/api/kurier']
    }
  },
  {
    path: 'admin',
    component: FeaturePlaceholder,
    title: 'Admin',
    data: {
      area: 'Admin',
      title: 'Admin panel',
      status: 'Planned',
      endpoints: ['/api/admin']
    }
  },
  {
    path: 'reports',
    component: FeaturePlaceholder,
    title: 'Reports',
    data: {
      area: 'Operations',
      title: 'Problem reports',
      status: 'Planned',
      endpoints: ['/api/zgloszenia']
    }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
