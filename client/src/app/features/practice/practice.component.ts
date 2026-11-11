import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PracticeQuestion, PracticeSocketService, ServerMessage } from '../../core/practice-socket.service';

const ATTEMPT_KEY = 'gk-practice-portal:attemptId';

type QuestionStatus = 'unvisited' | 'skipped' | 'answered' | 'review' | 'answered-review';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.css']
})
export class PracticeComponent implements OnInit, OnDestroy {
  private readonly socket = inject(PracticeSocketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);
  private subscription = new Subscription();

  questions: PracticeQuestion[] = [];
  currentIndex = 0;
  answers: Record<string, number> = {};
  visited = new Set<string>();
  markReviewStates: Record<string, boolean> = {};
  attemptId: string | null = null;
  connected = false;
  finishing = false;
  totalSeconds = 0;
  remainingSeconds = 0;
  categories: string[] = [];
  packLabel = '';
  daily = false;
  showInstructions = false;
  showAssamese = localStorage.getItem('gk-practice-portal:assamese') !== 'off';

  get hasAssamese(): boolean {
    return this.questions.some((q) => q.translation?.questionText);
  }

  toggleAssamese() {
    this.showAssamese = !this.showAssamese;
    localStorage.setItem('gk-practice-portal:assamese', this.showAssamese ? 'on' : 'off');
  }
  instructionStep: 1 | 2 = 1;
  agreed = false;
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  flagOpen = false;
  flagReason = '';
  flagNote = '';
  flagSending = false;
  readonly flagReasons = [
    { value: 'wrong_answer', label: 'The answer looks wrong' },
    { value: 'unclear_question', label: 'The question is unclear' },
    { value: 'typo', label: 'Spelling or wording mistake' },
    { value: 'translation', label: 'Assamese translation is wrong' },
    { value: 'other', label: 'Something else' }
  ];

  openFlag() {
    this.flagReason = '';
    this.flagNote = '';
    this.flagOpen = true;
  }

  closeFlag() {
    this.flagOpen = false;
  }

  onFlagNote(event: Event) {
    this.flagNote = (event.target as HTMLTextAreaElement).value;
  }

  async sendFlag() {
    if (!this.flagReason || this.flagSending || !this.currentQuestion) return;
    this.flagSending = true;
    try {
      await firstValueFrom(this.http.post(`${this.auth.apiBase}/flags`, {
        questionId: this.currentQuestion.id,
        ...(this.attemptId ? { attemptId: this.attemptId } : {}),
        reason: this.flagReason,
        note: this.flagNote.trim()
      }));
      this.flagOpen = false;
      this.snack.open('Thanks! Your report was sent to our team.', 'OK', { duration: 3000 });
    } catch {
      this.snack.open('Could not send your report. Please try again.', 'OK', { duration: 3000 });
    } finally {
      this.flagSending = false;
    }
  }

  get candidateName(): string {
    const user = this.auth.userSignal();
    return user?.name || user?.email || 'Candidate';
  }
  private startOptions: { exam?: 'police-forest'; categories?: string[]; mock?: number; daily?: boolean; pyq?: { year: number; paper: string }; questionCount: number } = { questionCount: 10 };

  private deadline = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;

  get timeLabel(): string {
    return this.format(this.remainingSeconds);
  }

  get totalLabel(): string {
    return this.format(this.totalSeconds);
  }

  get timeLow(): boolean {
    return this.totalSeconds > 0 && this.remainingSeconds <= 60;
  }

  get currentQuestion(): PracticeQuestion {
    return this.questions[this.currentIndex];
  }

  get passageText(): string {
    return this.currentQuestion?.passage?.text ?? '';
  }

  get currentAnswer(): number | undefined {
    return this.currentQuestion ? this.answers[this.currentQuestion.id] : undefined;
  }

  ngOnInit(): void {
    this.subscription.add(this.socket.messages$.subscribe((message) => this.onMessage(message)));
    this.subscription.add(this.socket.connected$.subscribe((connected) => {
      this.connected = connected;
      // The server freezes the clock on disconnect, so a reconnect must resume the session.
      if (connected && this.questions.length && this.attemptId) {
        this.socket.send({ type: 'session.resume', attemptId: this.attemptId });
      }
    }));
    this.ticker = setInterval(() => this.tick(), 1000);

    sessionStorage.removeItem('gk-practice-portal:attempt');
    const params = this.route.snapshot.queryParamMap;
    const requested = (params.get('categories') ?? '').split(',').filter(Boolean);
    const count = Number(params.get('count'));
    const mock = Number(params.get('mock'));
    const pyqYear = Number(params.get('pyqYear'));
    const pyqPaper = params.get('pyqPaper');
    this.startOptions = {
      ...(params.get('exam') === 'police-forest' ? { exam: 'police-forest' as const } : {}),
      ...(params.get('daily') ? { daily: true } : {}),
      ...(requested.length ? { categories: requested } : {}),
      ...(mock >= 1 && mock <= 10 ? { mock } : {}),
      ...(pyqYear && pyqPaper ? { pyq: { year: pyqYear, paper: pyqPaper } } : {}),
      questionCount: [10, 20, 50].includes(count) ? count : 10
    };

    if (params.get('new')) {
      // The server clock starts on session.start, so wait for the user to read the instructions.
      sessionStorage.removeItem(ATTEMPT_KEY);
      this.showInstructions = true;
      return;
    }

    const stored = sessionStorage.getItem(ATTEMPT_KEY);
    this.attemptId = stored && /^[a-f\d]{24}$/i.test(stored) ? stored : null;
    this.socket.send({ type: 'session.resume', ...(this.attemptId ? { attemptId: this.attemptId } : {}) });
  }

  get instructionTitle(): string {
    const o = this.startOptions;
    if (o.exam === 'police-forest') return `Assam Police and Forest - ${o.mock ? 'Constable Mock ' + o.mock : 'Subject Practice'}`;
    if (o.daily) return 'Daily Free Test';
    if (o.mock) return `Mock Test ${o.mock}`;
    if (o.pyq) return `Previous Year Paper · ${o.pyq.year === 2022 ? 'ADRE 1.0 (2022)' : 'ADRE 2.0 (2024)'}`;
    return o.categories?.length ? o.categories.join(' · ') : 'Practice Test';
  }

  get instructionDuration(): string {
    const o = this.startOptions;
    if (o.exam === 'police-forest' && o.mock) return '100 MCQs / 50 marks / 0.5 per correct answer / no negative marking. 90-minute practice timer (not official). SI/Forest-specific patterns not included yet.';
    return !o.daily && !o.mock && !o.pyq ? `${o.questionCount} questions · ${o.questionCount} minutes` : '';
  }

  beginTest() {
    if (!this.agreed) return;
    this.showInstructions = false;
    this.socket.send({ type: 'session.start', ...this.startOptions });
  }

  cancelStart() {
    this.router.navigateByUrl('/dashboard');
  }

  ngOnDestroy(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.subscription.unsubscribe();
    this.socket.disconnect();
  }

  exitTest() {
    this.socket.send({ type: 'session.pause' });
  }

  private tick() {
    if (!this.connected || !this.deadline) return;
    this.remainingSeconds = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
  }

  private format(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  selectAnswer(optionIndex: number) {
    if (!this.attemptId) return;
    this.socket.send({ type: 'answer.submit', attemptId: this.attemptId, questionId: this.currentQuestion.id, selectedAnswer: optionIndex });
  }

  clearAnswer() {
    if (!this.attemptId || this.currentAnswer === undefined) return;
    this.socket.send({ type: 'answer.clear', attemptId: this.attemptId, questionId: this.currentQuestion.id });
  }

  markForReview() {
    if (!this.attemptId) return;
    const questionId = this.currentQuestion.id;
    this.socket.send({ type: 'review.toggle', attemptId: this.attemptId, questionId, marked: !this.markReviewStates[questionId] });
  }

  goTo(index: number) {
    this.show(index);
  }

  previousQuestion() {
    if (this.currentIndex > 0) this.show(this.currentIndex - 1);
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.show(this.currentIndex + 1);
      return;
    }
    this.submitTest();
  }

  status(index: number): QuestionStatus {
    const id = this.questions[index].id;
    const answered = this.answers[id] !== undefined;
    const marked = Boolean(this.markReviewStates[id]);
    if (answered && marked) return 'answered-review';
    if (marked) return 'review';
    if (answered) return 'answered';
    return this.visited.has(id) ? 'skipped' : 'unvisited';
  }

  count(status: QuestionStatus): number {
    return this.questions.filter((_, index) => this.status(index) === status).length;
  }

  private show(index: number) {
    this.currentIndex = index;
    this.visited.add(this.questions[index].id);
  }

  submitTest() {
    if (!this.attemptId || this.finishing) return;
    this.finishing = true;
    this.socket.send({ type: 'session.finish', attemptId: this.attemptId });
  }

  private onMessage(message: ServerMessage) {
    switch (message.type) {
      case 'session.none':
        sessionStorage.removeItem(ATTEMPT_KEY);
        this.attemptId = null;
        this.socket.send({ type: 'session.start', ...this.startOptions });
        break;
      case 'session.started':
        this.attemptId = message.attemptId;
        sessionStorage.setItem(ATTEMPT_KEY, message.attemptId);
        this.questions = message.questions;
        this.answers = message.answers;
        this.categories = message.categories;
        this.packLabel = message.pack?.startsWith('police-')
          ? `Assam Police and Forest - ${message.mock ? 'Constable Mock ' + message.mock : 'Subject Practice'}`
          : message.mock ? `Mock ${message.mock}` : message.pyq ? `PYQ ${message.pyq.year === 2022 ? 'ADRE 1.0 (2022)' : 'ADRE 2.0 (2024)'}` : '';
        this.daily = message.kind === 'daily_free';
        if (this.route.snapshot.queryParamMap.keys.length) {
          this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        }
        this.totalSeconds = message.timer.totalSeconds;
        this.remainingSeconds = message.timer.remainingSeconds;
        this.deadline = Date.now() + message.timer.remainingSeconds * 1000;
        this.markReviewStates = Object.fromEntries(message.markedForReview.map((id) => [id, true]));
        if (this.currentIndex >= this.questions.length) this.currentIndex = 0;
        this.visited.add(this.questions[this.currentIndex].id);
        break;
      case 'answer.saved':
        this.answers = { ...this.answers, [message.questionId]: message.selectedAnswer };
        break;
      case 'answer.cleared': {
        const { [message.questionId]: _removed, ...rest } = this.answers;
        this.answers = rest;
        break;
      }
      case 'review.updated':
        this.markReviewStates = { ...this.markReviewStates, [message.questionId]: message.marked };
        break;
      case 'session.paused':
        this.router.navigateByUrl('/dashboard');
        break;
      case 'session.completed':
        if (message.autoSubmitted) this.snack.open('Time is up. Your test was submitted.', 'Close', { duration: 4000 });
        sessionStorage.removeItem(ATTEMPT_KEY);
        this.router.navigateByUrl(`/result/${message.attemptId}`);
        break;
      case 'error':
        this.finishing = false;
        if (message.code === 'UNAUTHORIZED') {
          this.router.navigateByUrl('/login');
          break;
        }
        if (message.message === 'Attempt not found.' || message.message === 'Attempt is no longer in progress.') {
          sessionStorage.removeItem(ATTEMPT_KEY);
          this.attemptId = null;
          this.socket.send({ type: 'session.resume' });
          break;
        }
        this.snack.open(message.message, 'Close', { duration: 4000 });
        break;
    }
  }
}
