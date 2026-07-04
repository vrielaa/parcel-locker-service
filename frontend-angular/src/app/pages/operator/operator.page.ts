import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ApiClient } from '../../core/api/api-client';
import { PackageRow } from '../../core/models/app.models';
import { formatDate, formatStatus, packageDimensions, packageId, packageTracking } from '../../core/utils/format';
import { buttonClass, dangerButtonClass, getValue, ghostButtonClass, inputClass, labelClass, pageClass, panelClass, subtlePanelClass } from '../../shared/page-ui';

@Component({
  selector: 'app-operator-page',
  templateUrl: './operator.page.html'
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
