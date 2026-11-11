import { Component, effect, inject, signal, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AdminPresenceService } from './core/admin-presence.service';
import { AdminChatService } from './core/admin-chat.service';
import { SeoService } from './core/seo.service';
import { LoadingService } from './core/loading.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly presence = inject(AdminPresenceService);
  readonly chat = inject(AdminChatService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly loading = inject(LoadingService);
  /** Delayed so very fast requests do not flash the indicator. */
  readonly showLoading = signal(false);
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private navigating = false;
  menuOpen = false;
  readonly onAdminPage = signal(this.router.url.startsWith('/admin'));

  readonly onLoginPage = signal(this.router.url.startsWith('/login'));

  constructor() {
    this.router.events.subscribe((event) => {
      // Route changes (including lazy-loaded pages and guards) count as loading work.
      if (event instanceof NavigationStart && !this.navigating) {
        this.navigating = true;
        this.loading.start();
      } else if ((event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) && this.navigating) {
        this.navigating = false;
        this.loading.stop();
      }
    });
    effect(() => {
      const active = this.loading.active();
      if (this.loadingTimer) clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
      if (!active) this.showLoading.set(false);
      else if (!untracked(this.showLoading)) this.loadingTimer = setTimeout(() => this.showLoading.set(true), 120);
    }, { allowSignalWrites: true });
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.onLoginPage.set(event.urlAfterRedirects.startsWith('/login'));
        this.onAdminPage.set(event.urlAfterRedirects.startsWith('/admin'));
        this.seo.updateForRoute();
      });
  }

  get initials(): string {
    const user = this.auth.userSignal();
    const source = user?.name ?? user?.email ?? '';
    return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
  }

  initialOf(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  logout() {
    this.auth.logout();
  }

  async sendChat(event: Event, box: HTMLInputElement) {
    event.preventDefault();
    const text = box.value;
    if (!text.trim()) return;
    box.value = '';
    await this.chat.send(text);
    this.scrollChat();
  }

  scrollChat() {
    setTimeout(() => {
      const body = document.getElementById('admin-chat-body');
      if (body) body.scrollTop = body.scrollHeight;
    }, 0);
  }
}
