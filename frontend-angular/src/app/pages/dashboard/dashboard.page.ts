import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { Role } from '../../core/models/app.models';
import { pageClass } from '../../shared/page-ui';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage {
  protected readonly auth = inject(AuthStore);
  protected readonly pageClass = pageClass;

  protected readonly modules = computed(() => {
    const role = this.auth.role();
    const items = [
      { area: 'Core', label: 'Automaty', path: '/parcel-lockers', description: 'Miasta, automaty i wizualizacja skrytek.', roles: ['ADMIN', 'OPERATOR', 'KURIER'] as Role[] },
      { area: 'Klient', label: 'Paczki', path: '/packages', description: 'Lista paczek, historia zdarzeń i nadawanie.', roles: ['KLIENT'] as Role[] },
      { area: 'Kurier', label: 'Transport', path: '/courier', description: 'Podejmowanie paczek i umieszczanie w skrytkach.', roles: ['KURIER'] as Role[] },
      { area: 'Operacje', label: 'Operator', path: '/operator', description: 'Zatwierdzanie paczek oczekujących.', roles: ['ADMIN', 'OPERATOR'] as Role[] },
      { area: 'Serwis', label: 'Zgłoszenia', path: '/reports', description: 'Oznaczanie uszkodzonych skrytek.', roles: ['ADMIN', 'OPERATOR', 'KURIER'] as Role[] },
      { area: 'Admin', label: 'Administracja', path: '/admin', description: 'Użytkownicy, automaty i naprawy.', roles: ['ADMIN'] as Role[] }
    ];

    return items.filter((item) => role && item.roles.includes(role));
  });
}
