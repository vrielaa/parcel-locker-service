import { Component, computed, input, output } from '@angular/core';

import { LockerCell } from '../core/models/app.models';
import { formatStatus, lockerDimensions, lockerId, lockerSize } from '../core/utils/format';

@Component({
  selector: 'app-locker-layout',
  templateUrl: './locker-layout.component.html'
})
export class LockerLayoutView {
  readonly layout = input<LockerCell[]>([]);
  readonly selectedId = input<number | null>(null);
  readonly selectable = input(false);
  readonly disabledStatuses = input<string[]>([]);
  readonly disabledIds = input<number[]>([]);
  readonly lockerSelected = output<LockerCell>();

  protected readonly lockerId = lockerId;
  protected readonly lockerSize = lockerSize;

  protected readonly sortedLayout = computed(() => {
    return [...this.layout()].sort((a, b) => {
      const rowDiff = this.cellRow(a) - this.cellRow(b);
      return rowDiff || this.cellColumn(a) - this.cellColumn(b);
    });
  });

  protected readonly rows = computed(() => {
    return Math.max(0, ...this.layout().map((cell) => this.positiveNumber(cell.liczba_wierszy)), ...this.layout().map((cell) => this.cellRow(cell)));
  });

  protected readonly columns = computed(() => {
    return Math.max(0, ...this.layout().map((cell) => this.positiveNumber(cell.liczba_kolumn)), ...this.layout().map((cell) => this.cellColumn(cell)));
  });

  protected readonly screenColumn = computed(() => {
    const fromApi = this.positiveNumber(this.layout()[0]?.ekran_w_kolumnie);
    if (fromApi) return fromApi;

    const rows = this.rows();
    const columns = this.columns();
    if (rows <= 2 || !columns) return 0;

    const occupied = new Set(this.layout().map((cell) => `${this.cellColumn(cell)}:${this.cellRow(cell)}`));
    for (let column = 1; column <= columns; column += 1) {
      let hasMiddleLocker = false;
      for (let row = 2; row < rows; row += 1) {
        if (occupied.has(`${column}:${row}`)) {
          hasMiddleLocker = true;
          break;
        }
      }
      if (!hasMiddleLocker) return column;
    }

    return Math.floor(columns / 2) + 1;
  });

  protected readonly gridTemplateColumns = computed(() => {
    const columns = Math.max(1, this.columns());
    return `repeat(${columns}, minmax(54px, 72px))`;
  });

  protected readonly gridTemplateRows = computed(() => {
    const rows = this.rows();
    if (rows <= 0) return '';
    if (rows === 1) return 'minmax(62px, 74px)';
    if (rows === 2) return 'repeat(2, minmax(62px, 74px))';
    return `minmax(62px, 74px) repeat(${rows - 2}, minmax(38px, 44px)) minmax(62px, 74px)`;
  });

  protected readonly sizeLegend = computed(() => {
    const bySize = new Map<string, string>();
    for (const cell of this.layout()) {
      const size = lockerSize(cell);
      if (size === '-' || bySize.has(size)) continue;
      bySize.set(size, lockerDimensions(cell));
    }

    const order: Record<string, number> = { S: 1, M: 2, L: 3 };
    return [...bySize.entries()]
      .map(([code, dimensions]) => ({ code, dimensions }))
      .sort((a, b) => (order[a.code] || 99) - (order[b.code] || 99));
  });

  protected lockerGridColumn(cell: LockerCell) {
    return `${this.cellColumn(cell)} / span 1`;
  }

  protected lockerGridRow(cell: LockerCell) {
    return `${this.cellRow(cell)} / span ${this.rowSpan(cell)}`;
  }

  protected screenGridColumn() {
    return `${this.screenColumn()} / span 1`;
  }

  protected screenGridRow() {
    const rows = this.rows();
    return rows > 2 ? `2 / span ${rows - 2}` : '1 / -1';
  }

  protected select(cell: LockerCell) {
    if (!this.selectable() || this.isDisabled(cell)) return;
    this.lockerSelected.emit(cell);
  }

  protected isDisabled(cell: LockerCell) {
    const status = String(cell.status || '').toUpperCase();
    return this.disabledStatuses().map((item) => item.toUpperCase()).includes(status) || this.disabledIds().includes(lockerId(cell));
  }

  protected lockerCellClass(cell: LockerCell) {
    const status = String(cell.status || '').toUpperCase();
    const selected = this.selectedId() === lockerId(cell);
    const selectable = this.selectable() && !this.isDisabled(cell);
    const size = lockerSize(cell);
    const tone =
      status === 'WOLNA'
        ? 'border-success/70 bg-success/15 text-success'
        : status === 'USZKODZONA'
          ? 'border-danger/70 bg-danger/15 text-danger'
          : 'border-brand/70 bg-brand-soft text-brand-strong';
    const sizeTone = size === 'L' ? 'shadow-md' : size === 'M' ? 'shadow-sm' : '';
    const interaction = selectable ? 'hover:-translate-y-0.5 hover:border-white focus:outline-none focus:ring-2 focus:ring-white/70' : 'cursor-default';

    return `grid h-full min-h-0 min-w-[54px] place-items-center rounded-md border px-1 py-1 text-center font-bold leading-none transition ${tone} ${sizeTone} ${interaction} ${selected ? 'ring-2 ring-ink-text ring-offset-2 ring-offset-ink' : ''} disabled:cursor-not-allowed disabled:opacity-45`;
  }

  protected lockerTitle(cell: LockerCell) {
    const dimensions = lockerDimensions(cell);
    return [
      `Skrytka #${lockerId(cell)}`,
      `Rozmiar ${lockerSize(cell)}`,
      dimensions,
      `Wiersz ${this.cellRow(cell)}, kolumna ${this.cellColumn(cell)}`,
      formatStatus(cell.status)
    ].filter(Boolean).join(' | ');
  }

  private rowSpan(cell: LockerCell) {
    return lockerSize(cell) === 'M' ? 2 : 1;
  }

  private cellRow(cell: LockerCell) {
    return this.positiveNumber(cell.wiersz) || 1;
  }

  private cellColumn(cell: LockerCell) {
    return this.positiveNumber(cell.kolumna) || 1;
  }

  private positiveNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}

