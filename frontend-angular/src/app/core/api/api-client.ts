import { HttpClient, HttpErrorResponse, HttpHeaders, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';

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

  resource<T>(path: () => string | undefined, defaultValue: T, debugName: string) {
    return httpResource<T>(
      () => {
        const currentPath = path();
        if (!currentPath) return undefined;

        return {
          url: this.url(currentPath),
          headers: this.authHeaderRecord()
        };
      },
      {
        defaultValue,
        parse: (value) => value as T,
        debugName
      }
    );
  }

  private request<T>(method: HttpMethod, path: string, body?: unknown) {
    return this.http.request<T>(method, this.url(path), {
      body,
      headers: this.authHeaders()
    }).pipe(catchError((error) => throwError(() => ApiError.from(error))));
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

  private authHeaderRecord() {
    const token = localStorage.getItem('token');

    return token ? { Authorization: `Bearer ${token}` } : undefined;
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
