import { environment } from '../../environments/environment';
import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';

export interface PracticeQuestion {
  id: string;
  questionText: string;
  options: string[];
  translation?: { questionText: string; options: string[] } | null;
  subject: string;
  topic: string;
  difficulty: string;
  language?: string;
  passage?: { title?: string; text?: string } | null;
  media?: Array<{ type?: string; url?: string; altText?: string }>;
}

export type ServerMessage =
  | { type: 'auth.ok' }
  | { type: 'pong' }
  | { type: 'session.none' }
  | {
      type: 'session.started';
      attemptId: string;
      totalQuestions: number;
      categories: string[];
      pack: string | null;
      mock: number | null;
      pyq: { year: number; paperId: string } | null;
      kind: 'practice' | 'daily_free';
      questions: PracticeQuestion[];
      answers: Record<string, number>;
      timer: { totalSeconds: number; remainingSeconds: number };
      markedForReview: string[];
    }
  | { type: 'session.paused' }
  | { type: 'answer.saved'; questionId: string; selectedAnswer: number }
  | { type: 'answer.cleared'; questionId: string }
  | { type: 'review.updated'; questionId: string; marked: boolean }
  | { type: 'session.completed'; attemptId: string; autoSubmitted: boolean; score: number; correctCount: number; incorrectCount: number; unansweredCount: number; percentage: number }
  | { type: 'presence.list'; admins: AdminPresence[] }
  | { type: 'chat.message'; message: ChatMessage }
  | { type: 'error'; code: string; message: string };

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface AdminPresence {
  userId: string;
  name: string;
  activeSet: string | null;
}

export type ClientMessage = Record<string, unknown> & { type: string };

@Injectable({ providedIn: 'root' })
export class PracticeSocketService implements OnDestroy {
  readonly messages$ = new Subject<ServerMessage>();
  readonly connected$ = new Subject<boolean>();

  private socket: WebSocket | null = null;
  private authenticated = false;
  private queue: ClientMessage[] = [];
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  private connecting = false;

  constructor(private readonly auth: AuthService) {}

  async connect() {
    if (this.connecting || (this.socket && this.socket.readyState <= WebSocket.OPEN)) return;

    // Access tokens are short-lived, so renew before authenticating the socket.
    this.connecting = true;
    try {
      await this.auth.ensureFreshToken();
    } finally {
      this.connecting = false;
    }
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;

    const token = this.auth.getToken();
    if (!token) return;

    this.closedByUser = false;
    const socket = new WebSocket(this.url);
    this.socket = socket;

    // The token goes in the first message so it never appears in URLs or logs.
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));

    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === 'auth.ok') {
        this.authenticated = true;
        this.retries = 0;
        this.startHeartbeat();
        this.connected$.next(true);
        this.flushQueue();
      }
      this.messages$.next(message);
    };

    socket.onclose = (event) => {
      this.authenticated = false;
      this.stopHeartbeat();
      this.connected$.next(false);
      if (!this.closedByUser && event.code !== 4401) this.scheduleReconnect();
    };
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN && this.authenticated) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    this.queue.push(message);
    this.connect();
  }

  disconnect() {
    this.closedByUser = true;
    this.queue = [];
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  ngOnDestroy() {
    this.disconnect();
  }

  private flushQueue() {
    const pending = this.queue;
    this.queue = [];
    pending.forEach((message) => this.send(message));
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.retries, 15000);
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.socket?.send(JSON.stringify({ type: 'ping' })), 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private get url(): string {
    const api: string = environment.apiUrl;
    return api.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws/practice';
  }
}
