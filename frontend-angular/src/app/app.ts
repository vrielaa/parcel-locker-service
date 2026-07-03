import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from './core/auth/auth.store';
import { Role } from './core/models/app.models';

interface NavItem {
  label: string;
  path: string;
  roles: readonly Role[];
}

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html'
})
export class App {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly currentUrl = signal(this.router.url);

  private readonly allNavItems = signal<readonly NavItem[]>([
    { label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'OPERATOR', 'KURIER', 'KLIENT'] },
    { label: 'Automaty', path: '/parcel-lockers', roles: ['ADMIN', 'OPERATOR', 'KURIER'] },
    { label: 'Paczki', path: '/packages', roles: ['KLIENT'] },
    { label: 'Kurier', path: '/courier', roles: ['KURIER'] },
    { label: 'Operator', path: '/operator', roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Zgłoszenia', path: '/reports', roles: ['ADMIN', 'OPERATOR', 'KURIER'] },
    { label: 'Admin', path: '/admin', roles: ['ADMIN'] }
  ]);

  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return role ? this.allNavItems().filter((item) => item.roles.includes(role)) : [];
  });

  protected readonly isPublicRoute = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/login') || url.startsWith('/register');
  });

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.currentUrl.set(event.urlAfterRedirects);
    });
  }

  protected async logout() {
    this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
