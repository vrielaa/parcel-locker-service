import { Component, OnInit, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { ApiClient } from '../../core/api/api-client';
import { LockerCell, ParcelLocker } from '../../core/models/app.models';
import { formatStatus, lockerId, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
import { LockerLayoutView } from '../../shared/locker-layout.component';

interface ReportFormModel {
  city: string;
  description: string;
}

@Component({
  selector: 'app-reports-page',
  imports: [FormField, LockerLayoutView],
  templateUrl: './reports.page.html'
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly cities = signal<string[]>([]);
  protected readonly parcelLockers = signal<ParcelLocker[]>([]);
  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);
  protected readonly layout = signal<LockerCell[]>([]);
  protected readonly selectedLocker = signal<LockerCell | null>(null);
  protected readonly reportModel = signal<ReportFormModel>({
    city: '',
    description: ''
  });
  protected readonly reportForm = form(this.reportModel);
  protected readonly message = signal('');

  protected readonly parcelLockerId = parcelLockerId;
  protected readonly parcelLockerName = parcelLockerName;
  protected readonly parcelLockerAddress = parcelLockerAddress;
  protected readonly lockerId = lockerId;
  protected readonly formatStatus = formatStatus;

  async ngOnInit() {
    this.cities.set(await this.api.get<string[]>('/miasta'));
  }

  protected async selectCity() {
    const city = this.reportModel().city;
    this.selectedParcelLocker.set(null);
    this.selectedLocker.set(null);
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
    await this.api.put(`/kurier/skrytki/${id}/status`, { opis: this.reportModel().description });
    this.message.set('Skrytka oznaczona jako uszkodzona.');
    this.reportForm.description().value.set('');
    const current = this.selectedParcelLocker();
    this.selectedLocker.set(null);
    if (current) await this.selectParcelLocker(current);
  }
}
