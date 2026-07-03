import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-feature-placeholder',
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss'
})
export class FeaturePlaceholder {
  private readonly route = inject(ActivatedRoute);

  protected readonly area = this.route.snapshot.data['area'] as string;
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly status = this.route.snapshot.data['status'] as string;
  protected readonly endpoints = this.route.snapshot.data['endpoints'] as string[];
}
