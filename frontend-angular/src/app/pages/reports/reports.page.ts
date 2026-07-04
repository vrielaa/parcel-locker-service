import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { LockerCell, ParcelLocker } from '../../core/models/app.models';
import { formatStatus, lockerId, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
import { buttonClass, getValue, inputClass, labelClass, pageClass, panelClass } from '../../shared/page-ui';
import { LockerLayoutView } from '../../shared/locker-layout.component';

@Component({
  selector: 'app-reports-page',
  imports: [LockerLayoutView],
  templateUrl: './reports.page.html'
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
