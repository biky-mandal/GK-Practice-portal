import { environment } from '../../environments/environment';
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

export interface UserSummary {
  id: string;
  email: string | null;
  name: string | null;
  phoneNumber?: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: UserSummary;
  token: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // The access token lives only in memory; the refresh cookie (httpOnly) restores it after a reload.
  private accessToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;
  readonly userSignal = signal<UserSummary | null>(null);

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  get apiBase(): string {
    return environment.apiUrl;
  }

  async register(name: string, email: string, password: string) {
    const response = await firstValueFrom(this.http.post<{ data: AuthResponse }>(`${this.apiBase}/auth/register`, { name, email, password }));
    this.setSession(response.data);
    return response.data.user;
  }

  async login(email: string, password: string) {
    const response = await firstValueFrom(this.http.post<{ data: AuthResponse }>(`${this.apiBase}/auth/login`, { email, password }));
    this.setSession(response.data);
    return response.data.user;
  }

  async forgotPassword(email: string) {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/forgot-password`, { email }));
  }

  async resetPassword(email: string, otp: string, password: string) {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/reset-password`, { email, otp, password }));
  }

  async requestAccountDeletionCode(email: string) {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/delete-account/request`, { email }));
  }

  async confirmAccountDeletionCode(email: string, code: string) {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/delete-account/confirm`, { email, code }));
  }

  async deleteMyAccount(password: string) {
    await firstValueFrom(this.http.delete(`${this.apiBase}/auth/me`, { body: { password, confirmation: true } }));
    this.clearSession();
    await this.router.navigateByUrl('/delete-account', { state: { deletionCompleted: true } });
  }

  // Called on app start; failure just means there is no active session.
  async restoreSession(): Promise<void> {
    await this.refreshSession();
  }

  // Single-flight so concurrent 401s trigger one refresh (refresh tokens are single-use).
  refreshSession(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = firstValueFrom(this.http.post<{ data: AuthResponse }>(`${this.apiBase}/auth/refresh`, {}))
        .then((response) => {
          this.setSession(response.data);
          return true;
        })
        .catch(() => {
          this.clearSession();
          return false;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  async logout() {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/logout`, {})).catch(() => null);
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  async logoutEverywhere() {
    await firstValueFrom(this.http.post(`${this.apiBase}/auth/logout-all`, {})).catch(() => null);
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  async loadProfile() {
    const response = await firstValueFrom(this.http.get<{ data: UserSummary }>(`${this.apiBase}/auth/me`));
    this.userSignal.set(response.data);
    return response.data;
  }

  async ensureFreshToken(): Promise<void> {
    const expiresAt = this.accessToken ? this.expiryOf(this.accessToken) : 0;
    if (!this.accessToken || expiresAt - Date.now() < 30_000) await this.refreshSession();
  }

  private expiryOf(token: string): number {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return (JSON.parse(atob(payload)).exp ?? 0) * 1000;
    } catch {
      return 0;
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken) && Boolean(this.userSignal());
  }

  isAdmin(): boolean {
    return this.isAuthenticated() && ['admin', 'superadmin'].includes(this.userSignal()?.role ?? '');
  }

  isSuperAdmin(): boolean {
    return this.isAuthenticated() && this.userSignal()?.role === 'superadmin';
  }

  getToken(): string | null {
    return this.accessToken;
  }

  clearSession() {
    this.accessToken = null;
    this.userSignal.set(null);
  }

  private setSession(data: AuthResponse) {
    this.accessToken = data.token;
    this.userSignal.set(data.user);
  }
}
