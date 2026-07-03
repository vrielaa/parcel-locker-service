import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Auth', path: '/login' },
    { label: 'Lockers', path: '/parcel-lockers' },
    { label: 'Packages', path: '/packages' },
    { label: 'Courier', path: '/courier' },
    { label: 'Admin', path: '/admin' },
    { label: 'Reports', path: '/reports' }
  ];
}
