import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ChatMessage, PracticeSocketService } from './practice-socket.service';

@Injectable({ providedIn: 'root' })
export class AdminChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(PracticeSocketService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly unread = signal(0);
  readonly open = signal(false);
  readonly error = signal('');
  private loaded = false;

  constructor() {
    this.socket.messages$.subscribe((message) => {
      if (message.type !== 'chat.message') return;
      this.add(message.message);
      if (!this.open() && message.message.userId !== this.auth.userSignal()?.id) this.unread.update((n) => n + 1);
    });

    effect(() => {
      if (this.auth.isAdmin()) {
        if (!this.loaded) {
          this.loaded = true;
          this.load();
        }
      } else {
        this.loaded = false;
        this.messages.set([]);
        this.unread.set(0);
        this.open.set(false);
      }
    }, { allowSignalWrites: true });
  }

  toggle() {
    this.open.update((value) => !value);
    if (this.open()) this.unread.set(0);
  }

  async send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.error.set('');
    try {
      const response = await firstValueFrom(this.http.post<{ data: ChatMessage }>(`${this.auth.apiBase}/admin/manage/broadcast`, { text: trimmed }));
      this.add(response.data);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Message not sent.');
    }
  }

  private add(message: ChatMessage) {
    if (this.messages().some((m) => m.id === message.id)) return;
    this.messages.update((list) => [...list, message].slice(-200));
  }

  private async load() {
    try {
      const response = await firstValueFrom(this.http.get<{ data: ChatMessage[] }>(`${this.auth.apiBase}/admin/manage/broadcast`));
      this.messages.set(response.data);
    } catch {
      this.loaded = false;
    }
  }
}
