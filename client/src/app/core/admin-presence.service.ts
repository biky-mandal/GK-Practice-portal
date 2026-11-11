import { Injectable, effect, inject, signal } from '@angular/core';
import { AdminPresence, PracticeSocketService } from './practice-socket.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminPresenceService {
  private readonly auth = inject(AuthService);
  private readonly socket = inject(PracticeSocketService);
  readonly admins = signal<AdminPresence[]>([]);
  private activeSet: string | null = null;

  constructor() {
    this.socket.messages$.subscribe((message) => {
      if (message.type === 'presence.list') this.admins.set(message.admins);
      else if (message.type === 'auth.ok' && this.auth.isAdmin()) this.report();
    });

    effect(() => {
      if (this.auth.isAdmin()) {
        this.socket.connect();
      } else {
        this.admins.set([]);
        this.activeSet = null;
      }
    }, { allowSignalWrites: true });
  }

  setActiveSet(title: string | null) {
    this.activeSet = title || null;
    if (this.auth.isAdmin()) this.report();
  }

  private report() {
    this.socket.send({ type: 'presence.update', activeSet: this.activeSet });
  }
}
