import { Component } from '@angular/core';

@Component({
  selector: 'app-migration-dashboard',
  templateUrl: './migration-dashboard.html',
  styleUrl: './migration-dashboard.scss'
})
export class MigrationDashboard {
  protected readonly modules = [
    { name: 'Auth', phase: 'Stage 3', status: 'Next', accent: 'blue' },
    { name: 'Parcel lockers', phase: 'Stage 4', status: 'Planned', accent: 'green' },
    { name: 'Packages', phase: 'Stage 4', status: 'Planned', accent: 'amber' },
    { name: 'Courier', phase: 'Stage 4', status: 'Planned', accent: 'red' },
    { name: 'Admin', phase: 'Stage 4', status: 'Planned', accent: 'violet' },
    { name: 'Reports', phase: 'Stage 4', status: 'Planned', accent: 'teal' }
  ];
}
