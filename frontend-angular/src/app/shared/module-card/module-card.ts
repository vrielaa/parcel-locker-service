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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleCard {
  readonly module = input.required<MigrationModule>();
  readonly selected = input(false);
  readonly moduleSelected = output<MigrationModule>();

  protected readonly statusLabel = computed(() => `${this.module().phase} · ${this.module().status}`);
  protected readonly cardClass = computed(() => [
    'grid min-h-[136px] w-full cursor-pointer gap-2.5 rounded-lg border border-l-4 border-line bg-surface p-[18px] text-left text-foreground transition hover:shadow-card',
    this.accentClass[this.module().accent],
    this.selected() ? 'shadow-card ring-2 ring-current/15' : ''
  ].join(' '));

  private readonly accentClass: Record<ModuleAccent, string> = {
    blue: 'border-l-brand hover:border-brand text-brand',
    green: 'border-l-success hover:border-success text-success',
    amber: 'border-l-warning hover:border-warning text-warning',
    red: 'border-l-danger hover:border-danger text-danger',
    violet: 'border-l-violet hover:border-violet text-violet',
    teal: 'border-l-teal hover:border-teal text-teal'
  };

  protected selectModule() {
    this.moduleSelected.emit(this.module());
  }
}
