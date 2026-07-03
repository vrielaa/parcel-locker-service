import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';

export type ModuleAccent = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

export interface MigrationModule {
  name: string;
  phase: string;
  status: 'Next' | 'Planned' | 'Done';
  accent: ModuleAccent;
}

@Component({
  selector: 'app-module-card',
  templateUrl: './module-card.html',
  styleUrl: './module-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleCard {
  readonly module = input.required<MigrationModule>();
  readonly selected = input(false);
  readonly moduleSelected = output<MigrationModule>();

  protected readonly statusLabel = computed(() => `${this.module().phase} · ${this.module().status}`);

  protected selectModule() {
    this.moduleSelected.emit(this.module());
  }
}
