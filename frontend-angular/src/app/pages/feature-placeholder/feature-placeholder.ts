import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { EndpointList } from '../../shared/endpoint-list/endpoint-list';

interface FeatureRouteData {
  area: string;
  title: string;
  status: string;
  endpoints: readonly string[];
}

const fallbackRouteData: FeatureRouteData = {
  area: 'Migration',
  title: 'Feature',
  status: 'Planned',
  endpoints: []
};

@Component({
  selector: 'app-feature-placeholder',
  imports: [EndpointList],
  templateUrl: './feature-placeholder.html'
})
export class FeaturePlaceholder {
  private readonly route = inject(ActivatedRoute);

  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly selectedEndpoint = signal<string | null>(null);
  protected readonly feature = computed(() => ({
    ...fallbackRouteData,
    ...(this.routeData() as Partial<FeatureRouteData>)
  }));

  protected selectEndpoint(endpoint: string) {
    this.selectedEndpoint.set(endpoint);
  }
}
