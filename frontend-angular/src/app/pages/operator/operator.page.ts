import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { OperatorApi } from '../../core/api/operator.api';
import { PackageRow } from '../../core/models/app.models';
import { apiMessage, formatDate, formatStatus, packageDimensions, packageId, packageTracking } from '../../core/utils/format';

interface OperatorFilterFormModel {
  query: string;
}

@Component({
  selector: 'app-operator-page',
  imports: [FormField],
  templateUrl: './operator.page.html'
})
export class OperatorPage {
  private readonly operatorApi = inject(OperatorApi);

  protected readonly selected = signal<PackageRow | null>(null);
  protected readonly filterModel = signal<OperatorFilterFormModel>({ query: '' });
  protected readonly filterForm = form(this.filterModel);
  protected readonly message = signal('');

  protected readonly packageId = packageId;
  protected readonly packageTracking = packageTracking;
  protected readonly packageDimensions = packageDimensions;
  protected readonly formatStatus = formatStatus;

  protected readonly packagesResource = this.operatorApi.pendingPackagesResource();
  protected readonly packages = computed<PackageRow[]>(() => this.packagesResource.hasValue() ? this.packagesResource.value().paczki || [] : []);

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

  protected load() {
    this.packagesResource.reload();
    this.selected.set(null);
  }

  protected approve() {
    const id = packageId(this.selected());
    if (!id) return;
    this.operatorApi.approvePackage(id).subscribe({
      next: () => {
        this.message.set('Paczka zatwierdzona.');
        this.load();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się zatwierdzić paczki.'))
    });
  }

  protected testDatabase() {
    this.operatorApi.testDatabase().subscribe({
      next: (data) => this.message.set(data.ok ? `Połączenie z bazą działa: ${formatDate(data.now)}` : 'Nie udało się sprawdzić bazy.'),
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się sprawdzić bazy.'))
    });
  }

  protected initializeDatabase() {
    if (!confirm('To odtworzy schemat i dane startowe bazy. Kontynuować?')) return;
    this.operatorApi.initializeDatabase().subscribe({
      next: () => {
        this.message.set('Baza została wczytana od nowa.');
        this.load();
      },
      error: (error) => this.message.set(apiMessage(error, 'Nie udało się wczytać bazy od nowa.'))
    });
  }
}
