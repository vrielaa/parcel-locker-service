import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { ApiClient } from '../../core/api/api-client';
import { PackageRow } from '../../core/models/app.models';
import { formatDate, formatStatus, packageDimensions, packageId, packageTracking } from '../../core/utils/format';

interface OperatorFilterFormModel {
  query: string;
}

@Component({
  selector: 'app-operator-page',
  imports: [FormField],
  templateUrl: './operator.page.html'
})
export class OperatorPage implements OnInit {
  private readonly api = inject(ApiClient);

  protected readonly packages = signal<PackageRow[]>([]);
  protected readonly selected = signal<PackageRow | null>(null);
  protected readonly filterModel = signal<OperatorFilterFormModel>({ query: '' });
  protected readonly filterForm = form(this.filterModel);
  protected readonly message = signal('');

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;

  protected readonly filtered = computed(() => {
    const query = this.filterModel().query.trim().toLowerCase();
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
