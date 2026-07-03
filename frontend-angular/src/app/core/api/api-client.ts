import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from './api.config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

@Injectable({
  providedIn: 'root'
})
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown = {}) {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body: unknown = {}) {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown) {
    try {
      return await firstValueFrom(
        this.http.request<T>(method, this.url(path), {
          body,
          headers: this.authHeaders()
        })
      );
    } catch (error) {
      throw ApiError.from(error);
    }
  }

  private url(path: string) {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private authHeaders() {
    const token = localStorage.getItem('token');

    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly details: unknown = null
  ) {
    super(message);
  }

  static from(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { error?: string; message?: string } | null;
      const message = payload?.error || payload?.message || error.message || 'API request failed';
      return new ApiError(message, error.status, error.error);
    }

    if (error instanceof Error) return new ApiError(error.message);

    return new ApiError('API request failed');
  }
}
