import { Injectable, computed, signal } from '@angular/core';
import { HttpContextToken } from '@angular/common/http';

/** Set on a request's HttpContext to keep it out of the global loading indicator (e.g. background refreshes). */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

/** Counts in-flight work (HTTP calls, route/lazy-module loads, socket waits) so the shell can show progress. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  readonly active = computed(() => this.pending() > 0);

  start(): void {
    this.pending.update((count) => count + 1);
  }

  stop(): void {
    this.pending.update((count) => Math.max(0, count - 1));
  }

  /** Runs `work` while counted as pending. */
  async track<T>(work: Promise<T>): Promise<T> {
    this.start();
    try {
      return await work;
    } finally {
      this.stop();
    }
  }
}
