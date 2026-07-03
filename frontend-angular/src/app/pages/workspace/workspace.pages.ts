import { Component, OnInit, WritableSignal, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiClient } from '../../core/api/api-client';
import { AuthStore } from '../../core/auth/auth.store';
import {
  ApiOk,
  FaultyLockerRow,
  LockerCell,
  PackageEvent,
  PackageRow,
  ParcelLocker,
  Role,
  UserRow
} from '../../core/models/app.models';
import {
  apiMessage,
  asArray,
  formatDate,
  formatStatus,
  lockerDimensions,
  lockerId,
  lockerSize,
  packageDimensions,
  packageId,
  packageTracking,
  parcelLockerAddress,
  parcelLockerId,
  parcelLockerName,
  roles
} from '../../core/utils/format';

const pageClass = 'grid gap-6';
const panelClass = 'rounded-2xl border border-line bg-surface p-6 shadow-card';
const subtlePanelClass = 'rounded-xl border border-line bg-background p-4';
const buttonClass = 'min-h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
const ghostButtonClass = 'min-h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-foreground transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClass = 'min-h-10 rounded-lg bg-danger px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass = 'min-h-10 rounded-lg border border-line bg-background px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelClass = 'grid gap-1.5 text-sm font-semibold text-foreground';

function getValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

function numberValue(value: string) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status: unknown) {
  const value = String(status || '').toUpperCase();
  if (['AKTYWNY', 'WOLNA', 'ODEBRANA'].includes(value)) return 'bg-success/10 text-success';
  if (['NADANA', 'W_DRODZE', 'W_AUTOMACIE'].includes(value)) return 'bg-brand-soft text-brand-strong';
  if (['CZEKA_NA_ZATWIERDZENIE', 'W_SERWISIE'].includes(value)) return 'bg-warning/10 text-warning';
  if (['USZKODZONA', 'NIEAKTYWNY', 'ANULOWANA', 'PRZETERMINOWANA'].includes(value)) return 'bg-danger/10 text-danger';
  return 'bg-background text-muted';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  template: `
    <section [class]="pageClass">
      <div class="grid gap-6 rounded-3xl border border-line bg-surface p-7 shadow-card lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-muted">Angular 2.0 workspace</p>
          <h1 class="m-0 text-4xl leading-tight">Panel operacyjny</h1>
          <p class="mt-3 max-w-3xl text-base leading-7 text-muted">
            Nowa wersja działa na Angularze, signals i Tailwindzie. Każdy kafel prowadzi do realnego widoku podłączonego do backendu.
          </p>
        </div>

        <div class="grid content-center gap-2 rounded-2xl bg-ink p-5 text-ink-text">
          <span class="text-sm text-ink-muted">Zalogowano jako</span>
          <strong class="break-all text-xl">{{ auth.user()?.email }}</strong>
          <span class="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{{ auth.role() }}</span>
        </div>
      </div>

      <section class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        @for (item of modules(); track item.path) {
          <a
            [routerLink]="item.path"
            class="grid min-h-36 content-between rounded-2xl border border-line bg-surface p-5 text-foreground no-underline shadow-card transition hover:-translate-y-0.5 hover:border-brand"
          >
            <span class="text-xs font-bold uppercase text-muted">{{ item.area }}</span>
            <strong class="text-xl">{{ item.label }}</strong>
            <small class="text-sm leading-6 text-muted">{{ item.description }}</small>
          </a>
        }
      </section>
    </section>
  `
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

@Component({
  selector: 'app-locker-layout',
  template: `
    <div class="grid gap-4">
      @if (layout().length) {
        <div class="overflow-auto rounded-2xl border border-line bg-background p-4">
          <div class="w-max rounded-2xl border border-line bg-ink p-3 shadow-inner">
            <div
              class="grid gap-1.5"
              role="grid"
              [attr.aria-label]="'Układ automatu: ' + rows() + ' wierszy i ' + columns() + ' kolumn'"
              [style.grid-template-columns]="gridTemplateColumns()"
              [style.grid-template-rows]="gridTemplateRows()"
            >
              @if (screenColumn()) {
                <div
                  class="grid place-items-center rounded-lg border border-dashed border-warning/60 bg-warning/15 px-2 text-center text-[0.62rem] font-black uppercase text-warning"
                  aria-hidden="true"
                  [style.grid-column]="screenGridColumn()"
                  [style.grid-row]="screenGridRow()"
                >
                  <span>Ekran</span>
                </div>
              }

              @for (cell of sortedLayout(); track lockerId(cell)) {
                <button
                  type="button"
                  role="gridcell"
                  [attr.aria-pressed]="selectedId() === lockerId(cell)"
                  [attr.aria-disabled]="!selectable() || isDisabled(cell)"
                  [attr.tabindex]="selectable() && !isDisabled(cell) ? 0 : -1"
                  [attr.title]="lockerTitle(cell)"
                  [disabled]="isDisabled(cell)"
                  [class]="lockerCellClass(cell)"
                  [style.grid-column]="lockerGridColumn(cell)"
                  [style.grid-row]="lockerGridRow(cell)"
                  (click)="select(cell)"
                >
                  <strong class="text-[0.78rem] leading-none">{{ lockerSize(cell) }}</strong>
                  <span class="text-[0.58rem] leading-none opacity-75">#{{ lockerId(cell) }}</span>
                </button>
              }
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 text-xs text-muted">
          <span class="rounded-full border border-line bg-background px-3 py-1 font-bold">{{ rows() }} wierszy x {{ columns() }} kolumn</span>
          @for (item of sizeLegend(); track item.code) {
            <span class="rounded-full border border-line bg-background px-3 py-1">
              <strong>{{ item.code }}</strong>{{ item.dimensions ? ' · ' + item.dimensions : '' }}
            </span>
          }
          <span class="rounded-full bg-success/10 px-3 py-1 font-bold text-success">Wolna</span>
          <span class="rounded-full bg-brand-soft px-3 py-1 font-bold text-brand-strong">Zajęta</span>
          <span class="rounded-full bg-danger/10 px-3 py-1 font-bold text-danger">Uszkodzona</span>
        </div>
      } @else {
        <p class="m-0 rounded-xl border border-line bg-background p-4 text-sm text-muted">Brak danych układu automatu.</p>
      }
    </div>
  `
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

@Component({
  selector: 'app-parcel-lockers-page',
  imports: [LockerLayoutView],
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <p class="mb-2 text-xs font-bold uppercase text-muted">Automaty</p>
        <h1 class="m-0 text-3xl">Lista automatów i skrytek</h1>
      </header>

      <section class="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside [class]="panelClass">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="m-0 text-lg">Miasta</h2>
            <button [class]="ghostButtonClass" type="button" (click)="loadCities()">Odśwież</button>
          </div>

          <div class="grid max-h-[520px] gap-2 overflow-auto pr-1">
            @for (city of cities(); track city) {
              <button
                type="button"
                [class]="city === selectedCity() ? activeListButtonClass : listButtonClass"
                (click)="selectCity(city)"
              >
                {{ city }}
              </button>
            }
          </div>
        </aside>

        <div class="grid gap-4">
          <section [class]="panelClass">
            <h2 class="m-0 text-lg">Automaty {{ selectedCity() ? 'w mieście ' + selectedCity() : '' }}</h2>

            @if (message()) {
              <p class="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ message() }}</p>
            }

            <div class="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              @for (locker of parcelLockers(); track parcelLockerId(locker)) {
                <button type="button" [class]="cardButtonClass" (click)="selectParcelLocker(locker)">
                  <span class="text-xs font-bold uppercase text-muted">#{{ parcelLockerId(locker) }}</span>
                  <strong class="text-left">{{ parcelLockerName(locker) }}</strong>
                  <small class="text-left text-muted">{{ parcelLockerAddress(locker) }}</small>
                </button>
              }
            </div>
          </section>

          @if (selectedParcelLocker()) {
            <section [class]="panelClass">
              <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="m-0 text-sm text-muted">Wybrany automat</p>
                  <h2 class="m-0 text-2xl">{{ parcelLockerName(selectedParcelLocker()) }}</h2>
                  <p class="m-0 text-sm text-muted">{{ parcelLockerAddress(selectedParcelLocker()) }}</p>
                </div>
                <button [class]="ghostButtonClass" type="button" (click)="reloadSelectedLayout()">Odśwież skrytki</button>
              </div>

              <app-locker-layout [layout]="layout()" />
            </section>
          }
        </div>
      </section>
    </section>
  `
})
export class ParcelLockersPage implements OnInit {
  protected readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly listButtonClass = 'min-h-10 rounded-lg border border-line bg-surface px-3 text-left text-sm font-semibold text-muted hover:border-brand hover:text-brand-strong';
  protected readonly activeListButtonClass = 'min-h-10 rounded-lg border border-brand bg-brand-soft px-3 text-left text-sm font-bold text-brand-strong';
  protected readonly cardButtonClass = 'grid min-h-32 gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand hover:shadow-card';

  protected readonly cities = signal<string[]>([]);
  protected readonly selectedCity = signal('');
  protected readonly parcelLockers = signal<ParcelLocker[]>([]);
  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);
  protected readonly layout = signal<LockerCell[]>([]);
  protected readonly message = signal('');

  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;
  protected readonly lockerId = lockerId;

  async ngOnInit() {
    await this.loadCities();
  }

  protected async loadCities() {
    this.message.set('Ładowanie miast...');
    try {
      const cities = await this.api.get<string[]>('/miasta');
      this.cities.set(cities);
      this.message.set(cities.length ? '' : 'Brak miast z automatami.');
      if (!this.selectedCity() && cities[0]) await this.selectCity(cities[0]);
    } catch (error) {
      this.message.set(apiMessage(error, 'Nie udało się pobrać miast.'));
    }
  }

  protected async selectCity(city: string) {
    this.selectedCity.set(city);
    this.selectedParcelLocker.set(null);
    this.layout.set([]);
    this.message.set('Ładowanie automatów...');

    try {
      const lockers = await this.api.get<ParcelLocker[]>(`/automaty?miasto=${encodeURIComponent(city)}`);
      this.parcelLockers.set(lockers);
      this.message.set(lockers.length ? '' : 'Brak automatów w tym mieście.');
    } catch (error) {
      this.parcelLockers.set([]);
      this.message.set(apiMessage(error, 'Nie udało się pobrać automatów.'));
    }
  }

  protected async selectParcelLocker(parcelLocker: ParcelLocker) {
    this.selectedParcelLocker.set(parcelLocker);
    await this.reloadSelectedLayout();
  }

  protected async reloadSelectedLayout() {
    const id = parcelLockerId(this.selectedParcelLocker());
    if (!id) return;

    try {
      const layout = await this.api.get<LockerCell[]>(`/automaty/${id}`);
      this.layout.set(layout);
    } catch (error) {
      this.layout.set([]);
      this.message.set(apiMessage(error, 'Nie udało się pobrać skrytek.'));
    }
  }

}

@Component({
  selector: 'app-packages-page',
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-muted">Klient</p>
            <h1 class="m-0 text-3xl">Paczki</h1>
          </div>
          <div class="flex gap-2">
            <button [class]="mode() === 'list' ? buttonClass : ghostButtonClass" type="button" (click)="mode.set('list')">Moje paczki</button>
            <button [class]="mode() === 'create' ? buttonClass : ghostButtonClass" type="button" (click)="mode.set('create')">Nadaj paczkę</button>
          </div>
        </div>
      </header>

      @if (mode() === 'list') {
        <section class="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <aside [class]="panelClass">
            <div class="mb-4 flex flex-wrap gap-2">
              <button [class]="packageMode() === 'received' ? buttonClass : ghostButtonClass" type="button" (click)="packageMode.set('received')">Do mnie</button>
              <button [class]="packageMode() === 'sent' ? buttonClass : ghostButtonClass" type="button" (click)="packageMode.set('sent')">Nadane</button>
              <button [class]="ghostButtonClass" type="button" (click)="loadPackages()">Odśwież</button>
            </div>

            <div class="grid gap-2">
              @for (pkg of filteredPackages(); track packageId(pkg)) {
                <button type="button" [class]="cardButtonClass" (click)="selectPackage(pkg)">
                  <span class="text-xs font-bold uppercase text-muted">#{{ packageId(pkg) }}</span>
                  <strong>{{ packageTracking(pkg) }}</strong>
                  <span [class]="'w-fit rounded-full px-2 py-1 text-xs font-bold ' + statusTone(pkg.status)">{{ formatStatus(pkg.status) }}</span>
                </button>
              } @empty {
                <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">Brak paczek w tej kategorii.</p>
              }
            </div>
          </aside>

          <section [class]="panelClass">
            @if (selectedPackage()) {
              <div class="grid gap-5">
                <div>
                  <p class="m-0 text-sm text-muted">Szczegóły</p>
                  <h2 class="m-0 text-2xl">{{ packageTracking(selectedPackage()) }}</h2>
                </div>

                <div class="grid gap-3 md:grid-cols-2">
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Status</span><p class="m-0">{{ formatStatus(selectedPackage()?.status) }}</p></div>
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Data nadania</span><p class="m-0">{{ formatDate(selectedPackage()?.data_nadania) }}</p></div>
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Nadawca</span><p class="m-0 break-all">{{ selectedPackage()?.nadawca_email || '-' }}</p></div>
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Odbiorca</span><p class="m-0 break-all">{{ selectedPackage()?.odbiorca_email || '-' }}</p></div>
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Automat</span><p class="m-0">{{ selectedPackage()?.automat_nazwa || selectedPackage()?.docelowy_automat_nazwa || '-' }}</p></div>
                  <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Termin odbioru</span><p class="m-0">{{ formatDate(selectedPackage()?.termin_odbioru) }}</p></div>
                </div>

                @if (canExtendSelected()) {
                  <button [class]="buttonClass" type="button" (click)="extendSelected()">Przedłuż odbiór o 24h</button>
                }

                <section>
                  <h3 class="text-lg">Historia zdarzeń</h3>
                  <div class="grid gap-2">
                    @for (event of events(); track event.zdarzenie_id || event.czas) {
                      <article class="rounded-lg border border-line bg-background p-3">
                        <strong>{{ event.typ || 'Zdarzenie' }}</strong>
                        <p class="m-0 text-sm text-muted">{{ formatDate(event.czas) }} · {{ event.opis || '-' }}</p>
                      </article>
                    } @empty {
                      <p class="m-0 text-sm text-muted">Brak zdarzeń.</p>
                    }
                  </div>
                </section>
              </div>
            } @else {
              <p class="m-0 text-muted">Wybierz paczkę z listy.</p>
            }
          </section>
        </section>
      } @else {
        <section [class]="panelClass">
          <h2 class="mt-0 text-2xl">Nadaj nową paczkę</h2>
          <form class="grid gap-4" (submit)="createPackage($event)">
            <div class="grid gap-4 md:grid-cols-2">
              <label [class]="labelClass">Email odbiorcy<input [class]="inputClass" type="email" [value]="receiverEmail()" (input)="setValue(receiverEmail, $event)"></label>
              <label [class]="labelClass">Telefon odbiorcy<input [class]="inputClass" [value]="receiverPhone()" (input)="setValue(receiverPhone, $event)"></label>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label [class]="labelClass">
                Miasto
                <select [class]="inputClass" [value]="createCity()" (change)="selectCreateCity($event)">
                  <option value="">Wybierz miasto</option>
                  @for (city of cities(); track city) {
                    <option [value]="city">{{ city }}</option>
                  }
                </select>
              </label>

              <label [class]="labelClass">
                Automat
                <select [class]="inputClass" [value]="createParcelLockerId()" (change)="setNumber(createParcelLockerId, $event)">
                  <option value="0">Wybierz automat</option>
                  @for (locker of filteredCreateParcelLockers(); track parcelLockerId(locker)) {
                    <option [value]="parcelLockerId(locker)">{{ parcelLockerName(locker) }} — {{ parcelLockerAddress(locker) }}</option>
                  }
                </select>
              </label>
            </div>

            <label [class]="labelClass">Szukaj automatu po kodzie lub adresie<input [class]="inputClass" [value]="lockerSearch()" (input)="setValue(lockerSearch, $event)" placeholder="np. BYD01A"></label>

            <div class="grid gap-4 md:grid-cols-3">
              <label [class]="labelClass">Szerokość (cm)<input [class]="inputClass" type="number" min="1" [value]="width()" (input)="setNumber(width, $event)"></label>
              <label [class]="labelClass">Wysokość (cm)<input [class]="inputClass" type="number" min="1" [value]="height()" (input)="setNumber(height, $event)"></label>
              <label [class]="labelClass">Głębokość (cm)<input [class]="inputClass" type="number" min="1" [value]="depth()" (input)="setNumber(depth, $event)"></label>
            </div>

            <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">Sugerowany rozmiar skrytki: <strong>{{ suggestedPackageSize() }}</strong></p>

            @if (formMessage()) {
              <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ formMessage() }}</p>
            }

            <button [class]="buttonClass" type="submit" [disabled]="submitting()">Nadaj paczkę</button>
          </form>
        </section>
      }
    </section>
  `
})
export class PackagesPage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthStore);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly subtlePanelClass = subtlePanelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly mode = signal<'list' | 'create'>('list');
  protected readonly packageMode = signal<'received' | 'sent'>('received');
  protected readonly packages = signal<PackageRow[]>([]);
  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly events = signal<PackageEvent[]>([]);
  protected readonly cities = signal<string[]>([]);
  protected readonly createParcelLockers = signal<ParcelLocker[]>([]);
  protected readonly createCity = signal('');
  protected readonly createParcelLockerId = signal(0);
  protected readonly lockerSearch = signal('');
  protected readonly receiverEmail = signal('');
  protected readonly receiverPhone = signal('');
  protected readonly width = signal(8);
  protected readonly height = signal(38);
  protected readonly depth = signal(64);
  protected readonly formMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly statusTone = statusTone;
  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;

  protected readonly filteredPackages = computed(() => {
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return this.packages().filter((pkg) => {
      if (this.packageMode() === 'sent') return Number(pkg.nadawca_id) === clientId;
      return Number(pkg.odbiorca_id) === clientId;
    });
  });

  protected readonly filteredCreateParcelLockers = computed(() => {
    const query = this.lockerSearch().trim().toLowerCase();
    if (!query) return this.createParcelLockers();

    return this.createParcelLockers().filter((locker) =>
      [parcelLockerName(locker), parcelLockerAddress(locker), parcelLockerId(locker)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });

  protected readonly suggestedPackageSize = computed(() => {
    const dims = [this.width(), this.height(), this.depth()].map(Number).sort((a, b) => a - b);
    if (dims.some((dim) => !Number.isFinite(dim) || dim <= 0)) return '-';

    const fits = (limit: number[]) => dims.every((dim, index) => dim <= limit[index]);
    if (fits([8, 20, 30])) return 'S';
    if (fits([20, 40, 40])) return 'M';
    if (fits([40, 60, 60])) return 'L';
    return 'Poza standardem S/M/L';
  });

  async ngOnInit() {
    await Promise.all([this.loadPackages(), this.loadCities()]);
  }

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set(getValue(event));
    this.formMessage.set('');
  }

  protected setNumber(target: WritableSignal<number>, event: Event) {
    target.set(numberValue(getValue(event)));
    this.formMessage.set('');
  }

  protected async loadPackages() {
    const data = await this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/me/paczki');
    this.packages.set(data.paczki || []);
    if (!this.selectedPackage() && this.filteredPackages()[0]) await this.selectPackage(this.filteredPackages()[0]);
  }

  protected async selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
    const id = packageId(pkg);
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; zdarzenia: PackageEvent[] }>(`/paczki/${id}/zdarzenia`);
    this.events.set(data.zdarzenia || []);
  }

  protected canExtendSelected() {
    const pkg = this.selectedPackage();
    const clientId = Number(this.auth.user()?.clientId ?? this.auth.user()?.klient_id ?? 0);
    return String(pkg?.status || '').toUpperCase() === 'W_AUTOMACIE' && Number(pkg?.odbiorca_id) === clientId;
  }

  protected async extendSelected() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    await this.api.post<ApiOk>(`/paczki/${id}/przedluzenia`, { ile_godzin: 24 });
    await this.loadPackages();
  }

  protected async loadCities() {
    this.cities.set(await this.api.get<string[]>('/miasta'));
  }

  protected async selectCreateCity(event: Event) {
    const city = getValue(event);
    this.createCity.set(city);
    this.createParcelLockerId.set(0);
    this.lockerSearch.set('');
    this.createParcelLockers.set(city ? await this.api.get<ParcelLocker[]>(`/automaty?miasto=${encodeURIComponent(city)}`) : []);
  }

  protected async createPackage(event: Event) {
    event.preventDefault();
    this.formMessage.set('');

    if (!this.receiverEmail().trim() || !this.createParcelLockerId()) {
      this.formMessage.set('Wybierz odbiorcę i automat docelowy.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.api.post('/me/paczki', {
        odbiorca_email: this.receiverEmail().trim().toLowerCase(),
        odbiorca: { telefon: this.receiverPhone().trim() || null },
        automat_id: this.createParcelLockerId(),
        szerokosc_cm: this.width(),
        wysokosc_cm: this.height(),
        glebokosc_cm: this.depth()
      });

      this.formMessage.set('Paczka została nadana i czeka na zatwierdzenie operatora.');
      this.receiverEmail.set('');
      this.receiverPhone.set('');
      await this.loadPackages();
      this.mode.set('list');
      this.packageMode.set('sent');
    } catch (error) {
      this.formMessage.set(apiMessage(error, 'Nie udało się nadać paczki.'));
    } finally {
      this.submitting.set(false);
    }
  }
}

@Component({
  selector: 'app-courier-page',
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-muted">Kurier</p>
            <h1 class="m-0 text-3xl">Transport paczek</h1>
          </div>
          <button [class]="ghostButtonClass" type="button" (click)="load()">Odśwież</button>
        </div>
      </header>

      <section class="grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <aside [class]="panelClass">
          <h2 class="mt-0 text-lg">Paczki do obsługi</h2>
          <div class="mb-4 grid gap-3 rounded-xl border border-line bg-background p-3">
            <label [class]="labelClass">
              Filtr miasta
              <select [class]="inputClass" [value]="courierCityFilter()" (change)="setCourierCityFilter($event)">
                <option value="">Wszystkie miasta</option>
                @for (city of courierCities(); track city) {
                  <option [value]="city">{{ city }}</option>
                }
              </select>
            </label>
            @if (courierCityFilter()) {
              <button [class]="ghostButtonClass" type="button" (click)="courierCityFilter.set('')">Wyczyść filtr</button>
            }
          </div>
          <div class="grid gap-2">
            @for (pkg of filteredCourierPackages(); track packageId(pkg)) {
              <button type="button" [class]="cardButtonClass" (click)="selectPackage(pkg)">
                <span class="text-xs font-bold uppercase text-muted">#{{ packageId(pkg) }}</span>
                <strong>{{ packageTracking(pkg) }}</strong>
                <span [class]="'w-fit rounded-full px-2 py-1 text-xs font-bold ' + statusTone(pkg.status)">{{ formatStatus(pkg.status) }}</span>
                <small class="text-muted">{{ pkg.docelowy_automat_miasto || pkg.docelowy_automat_adres || '-' }}</small>
              </button>
            } @empty {
              <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">Brak paczek do obsługi.</p>
            }
          </div>
        </aside>

        <section [class]="panelClass">
          @if (selectedPackage()) {
            <div class="grid gap-5">
              <div>
                <p class="m-0 text-sm text-muted">Wybrana paczka</p>
                <h2 class="m-0 text-2xl">{{ packageTracking(selectedPackage()) }}</h2>
              </div>

              <div class="grid gap-3 md:grid-cols-2">
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Status</span><p class="m-0">{{ formatStatus(selectedPackage()?.status) }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Wymiary</span><p class="m-0">{{ packageDimensions(selectedPackage()) }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Nadawca</span><p class="m-0 break-all">{{ selectedPackage()?.nadawca_email || '-' }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Odbiorca</span><p class="m-0 break-all">{{ selectedPackage()?.odbiorca_email || '-' }}</p></div>
                <div class="md:col-span-2" [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Automat docelowy</span><p class="m-0">{{ selectedPackage()?.docelowy_automat_nazwa || '-' }} — {{ selectedPackage()?.docelowy_automat_adres || '-' }}</p></div>
              </div>

              <div class="flex flex-wrap gap-2">
                @if (canStartTransport()) {
                  <button [class]="buttonClass" type="button" (click)="startTransport()">Podejmij paczkę</button>
                }

                @if (canPlaceInLocker()) {
                  <button [class]="ghostButtonClass" type="button" (click)="loadDestinationLockers()">Pokaż wolne skrytki</button>
                }
              </div>

              @if (destinationLockers().length) {
                <div class="grid gap-3 rounded-2xl border border-line bg-background p-4">
                  <h3 class="m-0 text-lg">Wybierz skrytkę</h3>
                  <div class="flex flex-wrap gap-2">
                    @for (locker of destinationLockers(); track lockerId(locker)) {
                      <button [class]="selectedLockerId() === lockerId(locker) ? buttonClass : ghostButtonClass" type="button" (click)="selectedLockerId.set(lockerId(locker))">
                        #{{ lockerId(locker) }} · {{ locker.rozmiar_kod || '-' }}
                      </button>
                    }
                  </div>
                  <button [class]="buttonClass" type="button" [disabled]="!selectedLockerId()" (click)="placeInLocker()">Umieść w automacie</button>
                </div>
              }

              @if (message()) {
                <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ message() }}</p>
              }

              <section>
                <h3 class="text-lg">Historia</h3>
                <div class="grid gap-2">
                  @for (event of events(); track event.zdarzenie_id || event.czas) {
                    <article class="rounded-lg border border-line bg-background p-3">
                      <strong>{{ event.typ || 'Zdarzenie' }}</strong>
                      <p class="m-0 text-sm text-muted">{{ formatDate(event.czas) }} · {{ event.opis || '-' }}</p>
                    </article>
                  }
                </div>
              </section>
            </div>
          } @else {
            <p class="m-0 text-muted">Wybierz paczkę z listy.</p>
          }
        </section>
      </section>
    </section>
  `
})
export class CourierPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly subtlePanelClass = subtlePanelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly pool = signal<PackageRow[]>([]);
  protected readonly mine = signal<PackageRow[]>([]);
  protected readonly selectedPackage = signal<PackageRow | null>(null);
  protected readonly events = signal<PackageEvent[]>([]);
  protected readonly destinationLockers = signal<LockerCell[]>([]);
  protected readonly selectedLockerId = signal(0);
  protected readonly courierCityFilter = signal('');
  protected readonly message = signal('');

  protected readonly allPackages = computed(() => [...this.mine(), ...this.pool()]);
  protected readonly courierCities = computed(() => {
    return [...new Set(this.allPackages().map((pkg) => String(pkg.docelowy_automat_miasto || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pl'));
  });
  protected readonly filteredCourierPackages = computed(() => {
    const city = this.courierCityFilter();
    return city ? this.allPackages().filter((pkg) => pkg.docelowy_automat_miasto === city) : this.allPackages();
  });
  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;
  protected readonly formatDate = formatDate;
  protected readonly statusTone = statusTone;
  protected readonly lockerId = lockerId;

  async ngOnInit() {
    await this.load();
  }

  protected async load() {
    const [mine, pool] = await Promise.all([
      this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/kurier/paczki'),
      this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/kurier/paczki/pool')
    ]);

    this.mine.set(mine.paczki || []);
    this.pool.set(pool.paczki || []);
  }

  protected async selectPackage(pkg: PackageRow) {
    this.selectedPackage.set(pkg);
    this.destinationLockers.set([]);
    this.selectedLockerId.set(0);
    await this.loadEvents();
  }

  protected setCourierCityFilter(event: Event) {
    this.courierCityFilter.set(getValue(event));
    this.selectedPackage.set(null);
    this.destinationLockers.set([]);
    this.selectedLockerId.set(0);
  }

  protected canStartTransport() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'NADANA';
  }

  protected canPlaceInLocker() {
    return String(this.selectedPackage()?.status || '').toUpperCase() === 'W_DRODZE';
  }

  protected async startTransport() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    await this.api.post(`/kurier/paczki/${id}/podejmij`);
    this.message.set('Transport rozpoczęty.');
    await this.load();
    const updated = this.allPackages().find((pkg) => packageId(pkg) === id);
    if (updated) await this.selectPackage(updated);
  }

  protected async loadDestinationLockers() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; skrytki: LockerCell[] }>(`/kurier/paczki/${id}/skrytki-docelowe`);
    this.destinationLockers.set(data.skrytki || []);
    this.message.set(data.skrytki?.length ? '' : 'Brak wolnych skrytek pasujących do paczki.');
  }

  protected async placeInLocker() {
    const id = packageId(this.selectedPackage());
    if (!id || !this.selectedLockerId()) return;
    await this.api.post(`/kurier/paczki/${id}/umiesc-w-automacie`, { skrytka_id: this.selectedLockerId() });
    this.message.set('Paczka została umieszczona w automacie.');
    await this.load();
    const updated = this.allPackages().find((pkg) => packageId(pkg) === id);
    if (updated) await this.selectPackage(updated);
  }

  private async loadEvents() {
    const id = packageId(this.selectedPackage());
    if (!id) return;
    const data = await this.api.get<{ ok: boolean; zdarzenia: PackageEvent[] }>(`/paczki/${id}/zdarzenia`);
    this.events.set(data.zdarzenia || []);
  }
}

@Component({
  selector: 'app-operator-page',
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-muted">Operator</p>
            <h1 class="m-0 text-3xl">Paczki do zatwierdzenia</h1>
          </div>
          <div class="flex flex-wrap gap-2">
            <button [class]="ghostButtonClass" type="button" (click)="load()">Odśwież</button>
            <button [class]="ghostButtonClass" type="button" (click)="testDatabase()">Test bazy</button>
            <button [class]="dangerButtonClass" type="button" (click)="initializeDatabase()">Wczytaj bazę</button>
          </div>
        </div>
      </header>

      <section class="grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <aside [class]="panelClass">
          <label [class]="labelClass">Szukaj<input [class]="inputClass" [value]="query()" (input)="setQuery($event)" placeholder="tracking, email, ID"></label>
          <div class="mt-4 grid gap-2">
            @for (pkg of filtered(); track packageId(pkg)) {
              <button type="button" [class]="cardButtonClass" (click)="selected.set(pkg)">
                <span class="text-xs font-bold uppercase text-muted">#{{ packageId(pkg) }}</span>
                <strong>{{ packageTracking(pkg) }}</strong>
                <small class="text-muted">{{ pkg.nadawca_email }} → {{ pkg.odbiorca_email }}</small>
              </button>
            } @empty {
              <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">Brak paczek do zatwierdzenia.</p>
            }
          </div>
        </aside>

        <section [class]="panelClass">
          @if (selected()) {
            <div class="grid gap-4">
              <h2 class="m-0 text-2xl">{{ packageTracking(selected()) }}</h2>
              <div class="grid gap-3 md:grid-cols-2">
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Status</span><p class="m-0">{{ formatStatus(selected()?.status) }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Wymiary</span><p class="m-0">{{ packageDimensions(selected()) }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Nadawca</span><p class="m-0 break-all">{{ selected()?.nadawca_email }}</p></div>
                <div [class]="subtlePanelClass"><span class="text-xs font-bold uppercase text-muted">Odbiorca</span><p class="m-0 break-all">{{ selected()?.odbiorca_email }}</p></div>
              </div>
              <button [class]="buttonClass" type="button" (click)="approve()">Zatwierdź paczkę</button>
              @if (message()) {
                <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ message() }}</p>
              }
            </div>
          } @else {
            <p class="m-0 text-muted">Wybierz paczkę do zatwierdzenia.</p>
          }
        </section>
      </section>
    </section>
  `
})
export class OperatorPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly subtlePanelClass = subtlePanelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly dangerButtonClass = dangerButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-2 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly packages = signal<PackageRow[]>([]);
  protected readonly selected = signal<PackageRow | null>(null);
  protected readonly query = signal('');
  protected readonly message = signal('');

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;

  protected readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) return this.packages();
    return this.packages().filter((pkg) =>
      [packageId(pkg), packageTracking(pkg), pkg.nadawca_email, pkg.odbiorca_email]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });

  async ngOnInit() {
    await this.load();
  }

  protected setQuery(event: Event) {
    this.query.set(getValue(event));
  }

  protected async load() {
    const data = await this.api.get<{ ok: boolean; paczki: PackageRow[] }>('/operator/paczki/pending');
    this.packages.set(data.paczki || []);
    this.selected.set(null);
  }

  protected async approve() {
    const id = packageId(this.selected());
    if (!id) return;
    await this.api.post(`/operator/paczki/${id}/approve`);
    this.message.set('Paczka zatwierdzona.');
    await this.load();
  }

  protected async testDatabase() {
    const data = await this.api.get<{ ok: boolean; now?: string }>('/db/test');
    this.message.set(data.ok ? `Połączenie z bazą działa: ${formatDate(data.now)}` : 'Nie udało się sprawdzić bazy.');
  }

  protected async initializeDatabase() {
    if (!confirm('To odtworzy schemat i dane startowe bazy. Kontynuować?')) return;
    await this.api.post('/db/init');
    this.message.set('Baza została wczytana od nowa.');
    this.selected.set(null);
    await this.load();
  }
}

@Component({
  selector: 'app-reports-page',
  imports: [LockerLayoutView],
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <p class="mb-2 text-xs font-bold uppercase text-muted">Serwis</p>
        <h1 class="m-0 text-3xl">Zgłoś uszkodzoną skrytkę</h1>
      </header>

      <section class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside [class]="panelClass">
          <label [class]="labelClass">
            Miasto
            <select [class]="inputClass" [value]="city()" (change)="selectCity($event)">
              <option value="">Wybierz miasto</option>
              @for (city of cities(); track city) {
                <option [value]="city">{{ city }}</option>
              }
            </select>
          </label>

          <div class="mt-4 grid gap-2">
            @for (locker of parcelLockers(); track parcelLockerId(locker)) {
              <button [class]="cardButtonClass" type="button" (click)="selectParcelLocker(locker)">
                <strong>{{ parcelLockerName(locker) }}</strong>
                <small class="text-muted">{{ parcelLockerAddress(locker) }}</small>
              </button>
            }
          </div>
        </aside>

        <section [class]="panelClass">
          @if (layout().length) {
            <div class="grid gap-4">
              <h2 class="m-0 text-2xl">{{ parcelLockerName(selectedParcelLocker()) }}</h2>
              <app-locker-layout
                [layout]="layout()"
                [selectable]="true"
                [selectedId]="lockerId(selectedLocker())"
                [disabledStatuses]="['USZKODZONA']"
                (lockerSelected)="selectedLocker.set($event)"
              />

              <label [class]="labelClass">Opis problemu<textarea [class]="inputClass + ' min-h-24 py-3'" [value]="description()" (input)="setValue(description, $event)"></textarea></label>

              <div class="flex flex-wrap items-center gap-3">
                <button [class]="buttonClass" type="button" [disabled]="!selectedLocker() || !description().trim()" (click)="markDamaged()">Oznacz jako uszkodzoną</button>
                <span class="text-sm text-muted">Wybrana: {{ selectedLocker() ? '#' + lockerId(selectedLocker()) : 'brak' }}</span>
              </div>

              @if (message()) {
                <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ message() }}</p>
              }
            </div>
          } @else {
            <p class="m-0 text-muted">Wybierz miasto i automat.</p>
          }
        </section>
      </section>
    </section>
  `
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly cardButtonClass = 'grid gap-1 rounded-xl border border-line bg-background p-4 text-left transition hover:border-brand';

  protected readonly cities = signal<string[]>([]);
  protected readonly city = signal('');
  protected readonly parcelLockers = signal<ParcelLocker[]>([]);
  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);
  protected readonly layout = signal<LockerCell[]>([]);
  protected readonly selectedLocker = signal<LockerCell | null>(null);
  protected readonly description = signal('');
  protected readonly message = signal('');

  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;
  protected readonly lockerId = lockerId;
  protected readonly formatStatus = formatStatus;

  async ngOnInit() {
    this.cities.set(await this.api.get<string[]>('/miasta'));
  }

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set(getValue(event));
  }

  protected async selectCity(event: Event) {
    const city = getValue(event);
    this.city.set(city);
    this.selectedParcelLocker.set(null);
    this.layout.set([]);
    this.parcelLockers.set(city ? await this.api.get<ParcelLocker[]>(`/automaty?miasto=${encodeURIComponent(city)}`) : []);
  }

  protected async selectParcelLocker(parcelLocker: ParcelLocker) {
    this.selectedParcelLocker.set(parcelLocker);
    this.selectedLocker.set(null);
    this.layout.set(await this.api.get<LockerCell[]>(`/automaty/${parcelLockerId(parcelLocker)}`));
  }

  protected isDamaged(cell: LockerCell) {
    return String(cell.status || '').toUpperCase() === 'USZKODZONA';
  }

  protected async markDamaged() {
    const id = lockerId(this.selectedLocker());
    if (!id) return;
    await this.api.put(`/kurier/skrytki/${id}/status`, { opis: this.description() });
    this.message.set('Skrytka oznaczona jako uszkodzona.');
    this.description.set('');
    const current = this.selectedParcelLocker();
    this.selectedLocker.set(null);
    if (current) await this.selectParcelLocker(current);
  }
}

@Component({
  selector: 'app-admin-page',
  template: `
    <section [class]="pageClass">
      <header [class]="panelClass">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-muted">Admin</p>
            <h1 class="m-0 text-3xl">Administracja</h1>
          </div>
          <div class="flex flex-wrap gap-2">
            <button [class]="tab() === 'users' ? buttonClass : ghostButtonClass" type="button" (click)="tab.set('users')">Użytkownicy</button>
            <button [class]="tab() === 'lockers' ? buttonClass : ghostButtonClass" type="button" (click)="tab.set('lockers')">Automaty</button>
          </div>
        </div>
      </header>

      @if (tab() === 'users') {
        <section class="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form [class]="panelClass" (submit)="createUser($event)">
            <h2 class="mt-0 text-xl">Dodaj użytkownika</h2>
            <div class="grid gap-3">
              <label [class]="labelClass">Rola<select [class]="inputClass" [value]="newUserRole()" (change)="newUserRole.set(asRole($event))">@for (role of availableRoles; track role) { <option [value]="role">{{ role }}</option> }</select></label>
              <label [class]="labelClass">Imię<input [class]="inputClass" [value]="newFirstName()" (input)="setValue(newFirstName, $event)"></label>
              <label [class]="labelClass">Nazwisko<input [class]="inputClass" [value]="newLastName()" (input)="setValue(newLastName, $event)"></label>
              <label [class]="labelClass">Email<input [class]="inputClass" type="email" [value]="newEmail()" (input)="setValue(newEmail, $event)"></label>
              <label [class]="labelClass">Telefon<input [class]="inputClass" [value]="newPhone()" (input)="setValue(newPhone, $event)"></label>
              <label [class]="labelClass">Hasło<input [class]="inputClass" type="password" [value]="newPassword()" (input)="setValue(newPassword, $event)"></label>
              <button [class]="buttonClass" type="submit">Dodaj</button>
            </div>
          </form>

          <section [class]="panelClass">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h2 class="m-0 text-xl">Użytkownicy</h2>
              <button [class]="ghostButtonClass" type="button" (click)="loadUsers()">Odśwież</button>
            </div>

            <div class="grid gap-4">
              @for (role of availableRoles; track role) {
                <section class="rounded-2xl border border-line bg-background p-4">
                  <h3 class="mt-0">{{ role }}</h3>
                  <div class="grid gap-2">
                    @for (user of usersByRole(role); track user.app_user_id) {
                      <article class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3">
                        <div>
                          <strong>{{ userLabel(user) }}</strong>
                          <p class="m-0 text-sm text-muted">{{ user.email }}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          @if (role === 'KLIENT' && user.klient_id) {
                            <button [class]="ghostButtonClass" type="button" (click)="loadClientPackages(user)">Paczki</button>
                          }
                          <button [class]="dangerButtonClass" type="button" (click)="deleteUser(user)">Usuń</button>
                        </div>
                      </article>
                    } @empty {
                      <p class="m-0 text-sm text-muted">Brak.</p>
                    }
                  </div>
                </section>
              }
            </div>
          </section>
        </section>

        @if (selectedClientEmail()) {
          <section [class]="panelClass">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 class="m-0 text-xl">Paczki klienta {{ selectedClientEmail() }}</h2>
              <div class="flex flex-wrap gap-2">
                <button [class]="clientPackageMode() === 'received' ? buttonClass : ghostButtonClass" type="button" (click)="loadSelectedClientPackages('received')">Odebrane</button>
                <button [class]="clientPackageMode() === 'sent' ? buttonClass : ghostButtonClass" type="button" (click)="loadSelectedClientPackages('sent')">Nadane</button>
              </div>
            </div>
            <div class="grid gap-2">
              @for (pkg of clientPackages(); track packageId(pkg)) {
                <article class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-background p-3">
                  <div>
                    <strong>{{ packageTracking(pkg) }}</strong>
                    <p class="m-0 text-sm text-muted">{{ formatStatus(pkg.status) }} · {{ pkg.docelowy_automat_label || '-' }}</p>
                  </div>
                  @if (pkg.status === 'W_AUTOMACIE') {
                    <button [class]="ghostButtonClass" type="button" (click)="simulatePickup(pkg)">Symuluj odbiór</button>
                  }
                </article>
              } @empty {
                <p class="m-0 text-sm text-muted">Brak paczek w tej kategorii.</p>
              }
            </div>
          </section>
        }
      } @else {
        <section class="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form [class]="panelClass" (submit)="createParcelLocker($event)">
            <h2 class="mt-0 text-xl">Dodaj automat</h2>
            <div class="grid gap-3">
              <label [class]="labelClass">Kod/nazwa<input [class]="inputClass" [value]="lockerCode()" (input)="setValue(lockerCode, $event)"></label>
              <label [class]="labelClass">Adres<input [class]="inputClass" [value]="lockerAddress()" (input)="setValue(lockerAddress, $event)"></label>
              <label [class]="labelClass">Miasto<input [class]="inputClass" [value]="lockerCity()" (input)="setValue(lockerCity, $event)"></label>
              <label [class]="labelClass">GPS<input [class]="inputClass" [value]="lockerGps()" (input)="setValue(lockerGps, $event)"></label>
              <div class="grid gap-3 md:grid-cols-2">
                <label [class]="labelClass">Wiersze<input [class]="inputClass" type="number" [value]="lockerRows()" (input)="setNumber(lockerRows, $event)"></label>
                <label [class]="labelClass">Kolumny<input [class]="inputClass" type="number" [value]="lockerColumns()" (input)="setNumber(lockerColumns, $event)"></label>
              </div>
              <button [class]="buttonClass" type="submit">Dodaj automat</button>
            </div>
          </form>

          <section [class]="panelClass">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h2 class="m-0 text-xl">Uszkodzone skrytki</h2>
              <button [class]="ghostButtonClass" type="button" (click)="loadFaultyLockers()">Odśwież</button>
            </div>
            <div class="grid gap-3">
              @for (row of faultyLockers(); track row.automat_id) {
                <article class="rounded-xl border border-line bg-background p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong>{{ row.nazwa }} #{{ row.automat_id }}</strong>
                      <p class="m-0 text-sm text-muted">{{ row.miasto }} · {{ row.adres }}</p>
                    </div>
                    <span class="rounded-full bg-danger/10 px-3 py-1 text-sm font-bold text-danger">{{ row.faulty_lockers_count }}</span>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    @for (id of row.faulty_lockers_ids || []; track id) {
                      <button [class]="ghostButtonClass" type="button" (click)="repairLocker(row, id)">Napraw #{{ id }}</button>
                    }
                  </div>
                </article>
              } @empty {
                <p class="m-0 text-sm text-muted">Brak uszkodzonych skrytek.</p>
              }
            </div>

            <div class="mt-6 grid gap-3 rounded-2xl border border-line bg-background p-4">
              <h3 class="m-0">Usuń automat po ID</h3>
              <div class="flex gap-2">
                <input [class]="inputClass + ' flex-1'" type="number" [value]="deleteParcelLockerId()" (input)="setNumber(deleteParcelLockerId, $event)">
                <button [class]="dangerButtonClass" type="button" [disabled]="!deleteParcelLockerId()" (click)="deleteParcelLocker()">Usuń</button>
              </div>
            </div>
          </section>
        </section>
      }

      @if (message()) {
        <p class="m-0 rounded-lg bg-background px-3 py-2 text-sm text-muted">{{ message() }}</p>
      }
    </section>
  `
})
export class AdminPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly pageClass = pageClass;
  protected readonly panelClass = panelClass;
  protected readonly buttonClass = buttonClass;
  protected readonly ghostButtonClass = ghostButtonClass;
  protected readonly dangerButtonClass = dangerButtonClass;
  protected readonly inputClass = inputClass;
  protected readonly labelClass = labelClass;
  protected readonly availableRoles = roles;

  protected readonly tab = signal<'users' | 'lockers'>('users');
  protected readonly users = signal<UserRow[]>([]);
  protected readonly clientPackages = signal<PackageRow[]>([]);
  protected readonly selectedClientId = signal(0);
  protected readonly selectedClientEmail = signal('');
  protected readonly clientPackageMode = signal<'received' | 'sent'>('received');
  protected readonly faultyLockers = signal<FaultyLockerRow[]>([]);
  protected readonly message = signal('');

  protected readonly newUserRole = signal<Role>('KLIENT');
  protected readonly newFirstName = signal('');
  protected readonly newLastName = signal('');
  protected readonly newEmail = signal('');
  protected readonly newPhone = signal('');
  protected readonly newPassword = signal('');

  protected readonly lockerCode = signal('');
  protected readonly lockerAddress = signal('');
  protected readonly lockerCity = signal('');
  protected readonly lockerGps = signal('');
  protected readonly lockerRows = signal(6);
  protected readonly lockerColumns = signal(4);
  protected readonly deleteParcelLockerId = signal(0);

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly formatStatus = formatStatus;

  async ngOnInit() {
    await Promise.all([this.loadUsers(), this.loadFaultyLockers()]);
  }

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set(getValue(event));
    this.message.set('');
  }

  protected setNumber(target: WritableSignal<number>, event: Event) {
    target.set(numberValue(getValue(event)));
    this.message.set('');
  }

  protected asRole(event: Event) {
    return getValue(event) as Role;
  }

  protected usersByRole(role: Role) {
    return this.users().filter((user) => user.rola === role);
  }

  protected userLabel(user: UserRow) {
    const first = user.klient_imie || user.pracownik_imie || '';
    const last = user.klient_nazwisko || user.pracownik_nazwisko || '';
    return `${first} ${last}`.trim() || user.email || '-';
  }

  protected async loadUsers() {
    const data = await this.api.get<{ ok: boolean; users: UserRow[] }>('/admin/users');
    this.users.set(data.users || []);
  }

  protected async createUser(event: Event) {
    event.preventDefault();
    await this.api.post('/admin/users', {
      role: this.newUserRole(),
      imie: this.newFirstName().trim(),
      nazwisko: this.newLastName().trim(),
      email: this.newEmail().trim().toLowerCase(),
      telefon: this.newPhone().trim(),
      password: this.newPassword()
    });
    this.message.set('Użytkownik dodany.');
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newEmail.set('');
    this.newPhone.set('');
    this.newPassword.set('');
    await this.loadUsers();
  }

  protected async deleteUser(user: UserRow) {
    if (!user.app_user_id || !confirm(`Usunąć użytkownika ${user.email}?`)) return;
    await this.api.delete(`/admin/users/${user.app_user_id}`);
    this.message.set('Użytkownik usunięty.');
    await this.loadUsers();
  }

  protected async loadClientPackages(user: UserRow) {
    if (!user.klient_id) return;
    this.selectedClientId.set(user.klient_id);
    this.selectedClientEmail.set(user.email || '');
    await this.loadSelectedClientPackages('received');
  }

  protected async loadSelectedClientPackages(mode: 'received' | 'sent') {
    const clientId = this.selectedClientId();
    if (!clientId) return;
    this.clientPackageMode.set(mode);
    const data = await this.api.get<{ ok: boolean; paczki: PackageRow[] }>(`/admin/clients/${clientId}/paczki?mode=${mode}`);
    this.clientPackages.set(data.paczki || []);
  }

  protected async simulatePickup(pkg: PackageRow) {
    const id = packageId(pkg);
    if (!id) return;
    await this.api.post(`/admin/paczki/${id}/simulate-pickup`);
    this.message.set('Odbiór zasymulowany.');
    this.clientPackages.update((rows) => rows.filter((row) => packageId(row) !== id));
  }

  protected async createParcelLocker(event: Event) {
    event.preventDefault();
    await this.api.post('/admin/automaty', {
      kod: this.lockerCode().trim(),
      adres: this.lockerAddress().trim(),
      miasto: this.lockerCity().trim(),
      wspolrzedne: this.lockerGps().trim(),
      liczbaWierszy: this.lockerRows(),
      liczbaKolumn: this.lockerColumns()
    });
    this.message.set('Automat dodany.');
  }

  protected async loadFaultyLockers() {
    const data = await this.api.get<{ ok: boolean; lockers: FaultyLockerRow[] }>('/admin/automaty/locker-faulty');
    this.faultyLockers.set(data.lockers || []);
  }

  protected async repairLocker(row: FaultyLockerRow, lockerIdValue: number) {
    if (!row.automat_id) return;
    await this.api.put(`/admin/automaty/${row.automat_id}/lockers/${lockerIdValue}/mark-repaired`);
    this.message.set(`Skrytka #${lockerIdValue} oznaczona jako naprawiona.`);
    await this.loadFaultyLockers();
  }

  protected async deleteParcelLocker() {
    if (!this.deleteParcelLockerId() || !confirm(`Usunąć automat #${this.deleteParcelLockerId()}?`)) return;
    await this.api.delete(`/admin/automaty/${this.deleteParcelLockerId()}`);
    this.message.set('Automat usunięty.');
    this.deleteParcelLockerId.set(0);
  }
}
