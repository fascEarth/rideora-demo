import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export type Role = 'admin' | 'dispatcher' | 'driver';
export interface SessionUser { id: string; name: string; email: string; role: Role; driverId: string | null }

const TOKEN_KEY = 'rideora.token';
const USER_KEY = 'rideora.user';
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Thin wrapper around HttpClient: adds the session token and turns errors into readable messages. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly token = signal<string | null>(store.get(TOKEN_KEY));
  readonly user = signal<SessionUser | null>(JSON.parse(store.get(USER_KEY) || 'null'));
  readonly signedIn = computed(() => !!this.token() && !!this.user());

  private headers(): Record<string, string> {
    const t = this.token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async req<T = any>(method: string, url: string, body?: any): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, '/api/' + url, { body, headers: this.headers() }));
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 401 && this.token() && !url.startsWith('auth/login')) {
        this.clear();
        const area = location.pathname.startsWith('/driver') ? '/driver/login' : '/admin/login';
        this.router.navigate([area], { queryParams: { next: location.pathname } });
      }
      const m = err.error?.message;
      throw new Error(Array.isArray(m) ? m.join(', ') : m || (err.status === 0 ? 'Cannot reach the server. Check your connection.' : 'Something went wrong. Please try again.'));
    }
  }
  get<T = any>(url: string) { return this.req<T>('GET', url); }
  post<T = any>(url: string, body?: any) { return this.req<T>('POST', url, body ?? {}); }
  put<T = any>(url: string, body: any) { return this.req<T>('PUT', url, body); }
  patch<T = any>(url: string, body: any) { return this.req<T>('PATCH', url, body); }
  del<T = any>(url: string) { return this.req<T>('DELETE', url); }

  async text(url: string): Promise<string> {
    return firstValueFrom(this.http.get('/api/' + url, { headers: this.headers(), responseType: 'text' }));
  }

  async login(email: string, password: string) {
    const r = await this.post<{ token: string; user: SessionUser }>('auth/login', { email, password });
    this.token.set(r.token); this.user.set(r.user);
    store.set(TOKEN_KEY, r.token); store.set(USER_KEY, JSON.stringify(r.user));
    return r.user;
  }
  clear() {
    this.token.set(null); this.user.set(null);
    store.set(TOKEN_KEY, null); store.set(USER_KEY, null);
  }
}

export const staffGuard: CanActivateFn = (_r, state) => {
  const api = inject(Api), router = inject(Router);
  const u = api.user();
  if (api.signedIn() && u && (u.role === 'admin' || u.role === 'dispatcher')) return true;
  if (u?.role === 'driver') return router.parseUrl('/driver');
  return router.createUrlTree(['/admin/login'], { queryParams: { next: state.url } });
};
export const adminGuard: CanActivateFn = () => {
  const api = inject(Api), router = inject(Router);
  return api.user()?.role === 'admin' ? true : router.parseUrl('/admin');
};
export const driverGuard: CanActivateFn = () => {
  const api = inject(Api), router = inject(Router);
  return api.signedIn() && api.user()?.role === 'driver' ? true : router.parseUrl('/driver/login');
};
