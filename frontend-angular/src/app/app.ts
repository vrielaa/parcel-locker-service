import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html'
})
export class App {
  protected readonly navItems = signal<readonly NavItem[]>([
    { label: 'Dashboard', path: '/' },
    { label: 'Auth', path: '/login' },
    { label: 'Lockers', path: '/parcel-lockers' },
    { label: 'Packages', path: '/packages' },
    { label: 'Courier', path: '/courier' },
    { label: 'Admin', path: '/admin' },
    { label: 'Reports', path: '/reports' }
  ]);
}
