import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { CourierApi } from '../../core/api/courier.api';
import { ParcelLockersApi } from '../../core/api/parcel-lockers.api';
import { LockerCell, ParcelLocker } from '../../core/models/app.models';
import { apiMessage, formatStatus, lockerId, parcelLockerAddress, parcelLockerId, parcelLockerName } from '../../core/utils/format';
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
export class ReportsPage {
  private readonly courierApi = inject(CourierApi);
  private readonly parcelLockersApi = inject(ParcelLockersApi);

  protected readonly selectedParcelLocker = signal<ParcelLocker | null>(null);
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

  protected readonly citiesResource = this.parcelLockersApi.citiesResource();
  protected readonly parcelLockersResource = this.parcelLockersApi.parcelLockersResource(() => this.reportModel().city);
  protected readonly layoutResource = this.parcelLockersApi.layoutResource(() => parcelLockerId(this.selectedParcelLocker()));

  protected readonly cities = computed<string[]>(() => this.citiesResource.hasValue() ? this.citiesResource.value() : []);
  protected readonly parcelLockers = computed<ParcelLocker[]>(() => this.parcelLockersResource.hasValue() ? this.parcelLockersResource.value() : []);
  protected readonly layout = computed<LockerCell[]>(() => this.layoutResource.hasValue() ? this.layoutResource.value() : []);

  protected selectCity() {
    this.selectedParcelLocker.set(null);
    this.selectedLocker.set(null);
  }

  protected selectParcelLocker(parcelLocker: ParcelLocker) {
    this.selectedParcelLocker.set(parcelLocker);
    this.selectedLocker.set(null);
  }

  protected isDamaged(cell: LockerCell) {
    return String(cell.status || '').toUpperCase() === 'USZKODZONA';
  }

  protected markDamaged() {
    const id = lockerId(this.selectedLocker());
    if (!id) return;
    this.courierApi.markLockerDamaged(id, this.reportModel().description).subscribe({
      next: () => {
        this.message.set('Skrytka oznaczona jako uszkodzona.');
        this.reportForm.description().value.set('');
        this.selectedLocker.set(null);
        this.layoutResource.reload();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się oznaczyć skrytki jako uszkodzonej.'))
    });
  }
}
