import { Component, computed, signal } from '@angular/core';

import {
  MigrationModule,
  ModuleCard
} from '../../shared/module-card/module-card';

@Component({
  selector: 'app-migration-dashboard',
  imports: [ModuleCard],
  templateUrl: './migration-dashboard.html',
  styleUrl: './migration-dashboard.scss'
})
export class MigrationDashboard {
  protected readonly modules = signal<readonly MigrationModule[]>([
    { name: 'Auth', phase: 'Stage 3', status: 'Next', accent: 'blue' },
    { name: 'Parcel lockers', phase: 'Stage 4', status: 'Planned', accent: 'green' },
    { name: 'Packages', phase: 'Stage 4', status: 'Planned', accent: 'amber' },
    { name: 'Courier', phase: 'Stage 4', status: 'Planned', accent: 'red' },
    { name: 'Admin', phase: 'Stage 4', status: 'Planned', accent: 'violet' },
    { name: 'Reports', phase: 'Stage 4', status: 'Planned', accent: 'teal' }
  ]);

  protected readonly selectedModule = signal<MigrationModule | null>(null);
  protected readonly nextModule = computed(
    () => this.modules().find((module) => module.status === 'Next') ?? null
  );
  protected readonly plannedCount = computed(
    () => this.modules().filter((module) => module.status === 'Planned').length
  );

  protected selectModule(module: MigrationModule) {
    this.selectedModule.set(module);
  }
}
