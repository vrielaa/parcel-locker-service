import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { API_BASE_URL } from './api.config';

type JsonBody = Record<string, unknown> | unknown[];

@Injectable({
  providedIn: 'root'
})
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string) {
    return this.http.get<T>(this.url(path), {
      headers: this.authHeaders()
    });
  }

  post<T>(path: string, body: JsonBody) {
    return this.http.post<T>(this.url(path), body, {
      headers: this.authHeaders()
    });
  }

  put<T>(path: string, body: JsonBody) {
    return this.http.put<T>(this.url(path), body, {
      headers: this.authHeaders()
    });
  }

  delete<T>(path: string) {
    return this.http.delete<T>(this.url(path), {
      headers: this.authHeaders()
    });
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
