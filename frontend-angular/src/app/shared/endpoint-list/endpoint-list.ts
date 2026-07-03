import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';

@Component({
  selector: 'app-endpoint-list',
  templateUrl: './endpoint-list.html',
  styleUrl: './endpoint-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EndpointList {
  readonly endpoints = input.required<readonly string[]>();
  readonly selectedEndpoint = input<string | null>(null);
  readonly endpointSelected = output<string>();

  protected readonly hasEndpoints = computed(() => this.endpoints().length > 0);

  protected selectEndpoint(endpoint: string) {
    this.endpointSelected.emit(endpoint);
  }
}
