import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';

export interface Page<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface VerificationInput {
  language: 'en' | 'as';
  questionText: string;
  options: string[];
  correctOption: number;
  asOfDate: string;
}

export interface VerificationReport {
  input: VerificationInput;
  result: {
    verdict: 'supported' | 'likely_incorrect' | 'inconclusive';
    suggestedOption: number | null;
    explanation: string;
    sources: Array<{ title: string; url: string; evidence: string }>;
    checkedAt: string;
    model: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  openFlags = 0;
  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {}

  private url(path: string) {
    return `${this.auth.apiBase}/admin/manage${path}`;
  }

  async get<T = any>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;
    return (await firstValueFrom(this.http.get<{ data: T }>(this.url(path), { params: clean }))).data;
  }

  async send<T = any>(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown): Promise<T> {
    const response = await firstValueFrom(this.http.request<{ data: T }>(method, this.url(path), { body }));
    return response.data;
  }

  message(error: unknown, fallback = 'Something went wrong.'): string {
    return error instanceof HttpErrorResponse ? error.error?.message ?? fallback : fallback;
  }
}
