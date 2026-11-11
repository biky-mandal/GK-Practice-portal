import { environment } from '../../../environments/environment';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EntitlementsService, Entitlements } from '../../core/entitlements.service';
import { ChartBar, ChartSlice } from '../../shared/charts/charts';
import { categoryMeta } from '../../shared/category-meta';
import { packageImageFor } from '../../shared/package-images';
import { simTheme } from '../admin/simulation-theme';
import { PLANS } from '../../shared/pricing';
import { PricingService } from '../../core/pricing.service';

interface PyqPaper {
  id: string;
  grade: string;
  paper: string;
  level: string;
  count: number;
}

interface PyqYear {
  year: number;
  papers: PyqPaper[];
}

interface MockSummary {
  number: number;
  title: string;
  count: number;
}

// ADRE 1.0 was held in 2022 and ADRE 2.0 in 2024.
const PYQ_YEAR_LABELS: Record<number, string> = { 2022: 'ADRE 1.0 (2022)', 2024: 'ADRE 2.0 (2024)' };

type DashboardView = 'progress' | 'practice' | 'results';

interface RecentAttempt {
  id: string;
  score: number;
  percentage: number;
  submittedAt: string;
  totalQuestions: number;
  kind?: string;
  exam?: string | null;
  pyq?: { year?: number; paperId?: string };
  mock?: number | null;
  categories?: string[];
}

interface SubjectCategory { name: string; count: number; free?: boolean }

interface PackBrief { icon: string; tagline: string; theme: string; image: string }

const PACK_BRIEFS: Record<string, PackBrief> = {
  pyq: { icon: '📚', tagline: 'ADRE 1.0 (2022) & ADRE 2.0 (2024) papers', theme: 'blue', image: packageImageFor('pyq')! },
  mock: { icon: '🏆', tagline: '10 exam-style tests with a real timer', theme: 'teal', image: packageImageFor('mock')! },
  subject: { icon: '📖', tagline: 'Practise topic by topic at your own pace', theme: 'violet', image: packageImageFor('subject')! },
  'police-subject': { icon: '🛡️', tagline: 'Constable written-test subjects', theme: 'violet', image: packageImageFor('police-subject')! },
  'police-mock': { icon: '🎯', tagline: '100 MCQs · 50 marks · no negative marking', theme: 'teal', image: packageImageFor('police-mock')! }
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entitlements = inject(EntitlementsService);
  readonly pricing = inject(PricingService);
  private purchasedIds: string[] = [];
  private purchasedAccess = new Map<string, string[]>();
  readonly isAdmin = () => this.auth.isAdmin();
  readonly isLoggedIn = () => this.auth.isAuthenticated();

  isFreePyq(paper: PyqPaper): boolean {
    return this.pyqYear === Math.max(...this.pyqYears.map((year) => year.year))
      && paper.id === this.pyqYears.find((year) => year.year === this.pyqYear)?.papers[0]?.id;
  }

  /** The admin-chosen free subject, playable without buying subject-wise practice. */
  get freeCategory(): string | null {
    return this.categories.find((category) => category.free && category.count > 0)?.name ?? null;
  }

  get policeFreeCategory(): string | null {
    return this.policeCategories.find((category) => category.free && category.count > 0)?.name ?? null;
  }

  stats = { attemptedCount: 0, testsCompleted: 0, averageAccuracy: 0 };
  view: DashboardView = 'progress';
  /** Pack whose detail page is open (`/dashboard/item/:pack`); null on the dashboard tabs. */
  selectedPack: string | null = null;
  private get packs() {
    return [...new Set([...PLANS.filter((plan) => this.ownsPack(plan.id)).map((plan) => plan.id),
      ...this.pricing.prices.filter((entry) => this.ownsPack(entry.pack) || (entry.visible && !entry.archived)).map((entry) => entry.pack)])];
  }
  get customPackages() {
    return this.pricing.prices.filter((entry) => !PLANS.some((plan) => plan.id === entry.pack) && this.showPack(entry.pack))
      .map((entry) => ({ ...entry, access: this.purchasedAccess.get(entry.pack) ?? entry.access }));
  }
  canBuy(pack: string) {
    const entry = this.pricing.prices.find((row) => row.pack === pack);
    return !!entry && entry.enabled && entry.visible && !entry.archived;
  }

  /** Whether a pack's full section is rendered; only on its own detail page. */
  showPack(pack: string): boolean {
    return !!this.selectedPack && pack === this.selectedPack && this.packs.includes(pack);
  }

  get listedPacks(): string[] {
    if (this.selectedPack || this.view !== 'practice') return [];
    const order = (pack: string) => this.pricing.prices.find((entry) => entry.pack === pack)?.sortOrder ?? PLANS.findIndex((plan) => plan.id === pack);
    return this.packs.sort((a, b) => order(a) - order(b));
  }

  brief(pack: string): PackBrief {
    const known = PACK_BRIEFS[pack];
    if (known) return known;
    const details = this.packDetails(pack);
    return {
      icon: '📦',
      tagline: details?.description || details?.perks[0] || 'Test Series',
      theme: 'blue',
      image: '/ADRE%203.0%20Assam%20Preparation%20Banner-2.png'
    };
  }

  get activeTab(): DashboardView {
    return this.selectedPack ? 'practice' : this.view;
  }

  get showProgress(): boolean {
    return this.isLoggedIn() && !this.selectedPack && this.view === 'progress';
  }

  get detailMissing(): boolean {
    return !!this.selectedPack && this.tier !== null && this.pricing.loaded && !this.packs.includes(this.selectedPack);
  }

  setView(view: DashboardView) {
    if (this.selectedPack) {
      this.router.navigate(['/dashboard'], { queryParams: { view } });
      return;
    }
    this.view = view;
    if (view === 'results' && this.isLoggedIn() && !this.resultsLoaded && !this.resultsLoading) this.loadRecentAttempts();
    this.router.navigate([], { relativeTo: this.route, queryParams: { view }, replaceUrl: true });
  }

  backToList() {
    this.router.navigate(['/dashboard'], { queryParams: { view: 'practice' } });
  }

  get visiblePackCount(): number {
    return this.packs.length;
  }
  recentAttempts: RecentAttempt[] = [];
  resultsLoading = false;
  resultsLoaded = false;
  resultsError = false;
  activeAttempt: { totalQuestions: number; answeredCount: number; remainingSeconds: number } | null = null;
  outcomeSlices: ChartSlice[] = [];
  recentBars: ChartBar[] = [];
  subjectBars: ChartBar[] = [];
  categories: SubjectCategory[] = [];
  categoriesLoading = true;
  selected = new Set<string>();
  questionCount = 10;
  readonly meta = categoryMeta;
  readonly theme = simTheme;
  pyqYears: PyqYear[] = [];
  pyqYear = 0;
  pyqOwned = false;
  pyqLoading = true;
  mocks: MockSummary[] = [];
  mocksLoading = true;
  mockOwned = false;
  subjectOwned = false;
  policeSubjectOwned = false;
  policeMockOwned = false;
  policeCategories: SubjectCategory[] = [];
  policeLoading = true;
  policeMocks: MockSummary[] = [];
  policeSelected = new Set<string>();
  policeQuestionCount = 10;
  policeLoadError = '';
  get policeHasQuestions() { return this.policeCategories.some((category) => category.count > 0); }
  prices: Record<string, number> = {};

  tier: Entitlements['tier'] | null = null;
  daily: { status: 'available' | 'in_progress' | 'completed'; questionCount: number } | null = null;

  yearLabel(year: number): string {
    return PYQ_YEAR_LABELS[year] ?? `ADRE ${year}`;
  }

  attemptLabel(attempt: RecentAttempt): string {
    const exam = attempt.exam === 'police-forest' ? 'Assam Police and Forest' : 'ADRE';
    if (attempt.kind === 'daily_free') return 'Daily Free Test';
    if (attempt.pyq?.year && attempt.pyq.paperId) {
      const paper = attempt.pyq.paperId.match(/^g(\d+)-p(\d+)$/i);
      return `${this.yearLabel(attempt.pyq.year)} · ${paper ? `Grade ${paper[1]}, Paper ${paper[2]}` : attempt.pyq.paperId}`;
    }
    if (attempt.mock) return `${exam} · Mock ${attempt.mock}`;
    return `${exam} · ${attempt.categories?.length ? attempt.categories.join(', ') : 'Practice test'}`;
  }

  async loadRecentAttempts() {
    this.resultsLoading = true;
    this.resultsError = false;
    try {
      const response = await firstValueFrom(this.http.get<{ data: RecentAttempt[] }>(`${environment.apiUrl}/dashboard/recent-attempts`));
      this.recentAttempts = response.data;
      this.resultsLoaded = true;
    } catch {
      this.resultsError = true;
    } finally {
      this.resultsLoading = false;
    }
  }

  paperNumber(paper: string): string {
    const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
    const label = paper.replace(/^paper[-\s]*/i, '').toUpperCase();
    return String(roman[label] ?? label);
  }

  get showDaily(): boolean {
    return this.isLoggedIn() && this.tier !== null && !this.subjectOwned && this.tier !== 'admin';
  }

  startDaily() {
    if (!this.daily || this.daily.status === 'completed') return;
    // An in-progress daily test is resumed; otherwise start today's test.
    if (this.daily.status === 'in_progress') this.router.navigate(['/practice', 'gk']);
    else this.router.navigate(['/practice', 'gk'], { queryParams: { new: 1, daily: 1 } });
  }

  pending: { title: string; detail: string; run: () => void } | null = null;

  reviews: Partial<Record<string, { average: number; count: number; mine: { rating: number; comment: string } | null; recent: Array<{ name: string; rating: number; comment: string; createdAt: string }> }>> = {};
  reviewPack: string | null = null;
  draftRating = 0;
  draftComment = '';
  reviewSending = false;
  private readonly snack = inject(MatSnackBar);
  packName(pack: string) {
    return this.pricing.prices.find((entry) => entry.pack === pack)?.name ?? PLANS.find((plan) => plan.id === pack)?.name ?? pack;
  }
  packDetails(pack: string) {
    const entry = this.pricing.prices.find((row) => row.pack === pack);
    return entry ? this.pricing.planFor(entry) : PLANS.find((plan) => plan.id === pack);
  }

  ownsPack(pack: string) {
    return Object.entries({ pyq: this.pyqOwned, mock: this.mockOwned, subject: this.subjectOwned,
      'police-subject': this.policeSubjectOwned, 'police-mock': this.policeMockOwned })
      .some(([id, owned]) => id === pack && owned) || this.purchasedIds.includes(pack) || this.isAdmin();
  }

  togglePolice(name: string) {
    if (!this.policeSubjectOwned) return;
    if (this.policeSelected.has(name)) this.policeSelected.delete(name);
    else this.policeSelected.add(name);
  }

  askPoliceMock(mock: MockSummary) {
    if ((!this.policeMockOwned && mock.number !== 1) || mock.count !== 100) return;
    this.pending = {
      title: `Assam Police and Forest - ${mock.title}`,
      detail: 'Constable pattern: 100 MCQs, 50 marks, no negative marking. 90-minute practice timer; not an official duration.',
      run: () => this.router.navigate(['/practice', 'gk'], {
        queryParams: { new: 1, exam: 'police-forest', mock: mock.number }
      })
    };
  }

  startPolicePractice() {
    const free = this.policeFreeCategory;
    if (!this.policeSubjectOwned && !free) return;
    const categories = this.policeSubjectOwned ? Array.from(this.policeSelected) : [free as string];
    this.pending = {
      title: `Assam Police and Forest - ${this.policeSubjectOwned ? 'Subject Practice' : `${free} (Free)`}`,
      detail: `${this.policeQuestionCount} questions requested. Any unfinished session will be replaced.`,
      run: () => this.router.navigate(['/practice', 'gk'], {
        queryParams: { new: 1, exam: 'police-forest', count: this.policeQuestionCount,
          ...(categories.length ? { categories: categories.join(',') } : {}) }
      })
    };
  }

  ratingLabel(pack: string) {
    const r = this.reviews[pack];
    if (!r?.count) return this.ownsPack(pack) ? '☆ Rate this Test Series' : '☆ No reviews yet';
    return `★ ${r.average} · ${r.count} review${r.count === 1 ? '' : 's'}`;
  }

  async loadReviews() {
    const api: string = environment.apiUrl;
    try {
      this.reviews = (await firstValueFrom(this.http.get<{ data: DashboardComponent['reviews'] }>(`${api}/reviews`))).data;
    } catch {
      this.reviews = {};
    }
  }

  openReviews(pack: string) {
    const mine = this.reviews[pack]?.mine;
    this.draftRating = mine?.rating ?? 0;
    this.draftComment = mine?.comment ?? '';
    this.reviewPack = pack;
  }

  closeReviews() {
    this.reviewPack = null;
  }

  onDraftComment(event: Event) {
    this.draftComment = (event.target as HTMLTextAreaElement).value;
  }

  async submitReview() {
    if (!this.reviewPack || !this.draftRating || this.reviewSending) return;
    const api: string = environment.apiUrl;
    this.reviewSending = true;
    try {
      await firstValueFrom(this.http.put(`${api}/reviews/${this.reviewPack}`, { rating: this.draftRating, comment: this.draftComment.trim() }));
      await this.loadReviews();
      this.snack.open('Thanks for your review!', 'OK', { duration: 3000 });
    } catch {
      this.snack.open('Could not save your review. Please try again.', 'OK', { duration: 3000 });
    } finally {
      this.reviewSending = false;
    }
  }

  askPyq(p: PyqPaper) {
    if ((!this.pyqOwned && !this.isFreePyq(p)) || p.count === 0) return;
    const year = this.pyqYear;
    this.pending = {
      title: `Paper ${this.paperNumber(p.paper)}`,
      detail: `${this.yearLabel(year)} · ${p.grade} · ${p.level} · ${p.count} question${p.count === 1 ? '' : 's'}`,
      run: () => this.startPyq(year, p)
    };
  }

  askMock(m: MockSummary) {
    if ((!this.mockOwned && m.number !== 1) || m.count === 0) return;
    this.pending = {
      title: m.title,
      detail: `Full-length mock · ${m.count} question${m.count === 1 ? '' : 's'} · timed`,
      run: () => this.startMock(m)
    };
  }

  cancelPending() {
    this.pending = null;
  }

  confirmPending() {
    const action = this.pending;
    this.pending = null;
    action?.run();
  }

  startPyq(year: number, paper: PyqPaper) {
    this.router.navigate(['/practice', 'gk'], {
      queryParams: { new: 1, pyqYear: year, pyqPaper: paper.id }
    });
  }

  get pyqPapers(): PyqPaper[] {
    return this.pyqYears.find((entry) => entry.year === this.pyqYear)?.papers ?? [];
  }

  startMock(mock: MockSummary) {
    this.router.navigate(['/practice', 'gk'], { queryParams: { new: 1, mock: mock.number } });
  }

  toggle(name: string) {
    if (!this.subjectOwned) return;
    if (this.selected.has(name)) this.selected.delete(name);
    else this.selected.add(name);
  }

  startPractice() {
    const free = this.freeCategory;
    if (!this.subjectOwned && !free) return;
    if (this.activeAttempt && !confirm('Starting a new practice will replace your unfinished session. Continue?')) return;
    // Without the package, only the free subject can be practised.
    const categories = this.subjectOwned ? Array.from(this.selected) : [free as string];
    this.router.navigate(['/practice', 'gk'], {
      queryParams: {
        new: 1,
        count: this.questionCount,
        ...(categories.length ? { categories: categories.join(',') } : {})
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.selectedPack = params.get('pack');
      if (this.selectedPack && typeof window !== 'undefined') window.scrollTo({ top: 0 });
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const view = params.get('view');
      if (view === 'practice' || view === 'purchased' || view === 'other') this.view = 'practice';
      else if (view === 'results' && this.isLoggedIn()) {
        this.view = 'results';
        if (!this.resultsLoaded && !this.resultsLoading) this.loadRecentAttempts();
      }
      else this.view = this.isLoggedIn() ? 'progress' : 'practice';
    });
    if (this.isLoggedIn()) {
      this.auth.loadProfile().catch(() => this.auth.clearSession());
      this.loadStats();
    }
    this.loadEntitlements();
  }

  private async loadEntitlements() {
    const api: string = environment.apiUrl;
    await this.pricing.load();
    try {
      if (!this.isLoggedIn()) {
        this.tier = 'guest';
      } else {
        const entitlements = await this.entitlements.load();
        this.tier = entitlements.tier;
        this.subjectOwned = entitlements.packs.includes('subject');
        this.pyqOwned = entitlements.packs.includes('pyq');
        this.mockOwned = entitlements.packs.includes('mock');
        this.policeSubjectOwned = entitlements.packs.includes('police-subject');
        this.policeMockOwned = entitlements.packs.includes('police-mock');
        this.purchasedIds = entitlements.purchases.map((purchase) => purchase.pack);
        this.purchasedAccess = new Map(entitlements.purchases.flatMap((purchase) =>
          purchase.access ? [[purchase.pack, purchase.access] as const] : []));
        this.prices = entitlements.prices ?? {};
        if (this.showDaily) {
          const response = await firstValueFrom(this.http.get<{ data: NonNullable<DashboardComponent['daily']> }>(`${api}/tests/daily-free`));
          this.daily = response.data;
        }
      }
    } catch {
      this.snack.open('Could not load your purchases. Please reload to check your access.', 'OK', { duration: 5000 });
    }
    this.loadCategories();
    this.loadPyq();
    this.loadMocks();
    this.loadReviews();
    this.loadPoliceContent();
  }

  async loadPoliceContent() {
    this.policeLoadError = '';
    this.policeLoading = true;
    try {
      const [categories, mocks] = await Promise.all([
        firstValueFrom(this.http.get<{ data: DashboardComponent['policeCategories'] }>(`${this.auth.apiBase}/tests/categories`, { params: { exam: 'police-forest' } })),
        firstValueFrom(this.http.get<{ data: { mocks: MockSummary[] } }>(`${this.auth.apiBase}/tests/mocks`, { params: { exam: 'police-forest' } }))
      ]);
      this.policeCategories = categories.data;
      this.policeMocks = mocks.data.mocks;
    } catch {
      this.policeLoadError = 'Could not load Assam Police and Forest questions. Please retry.';
    } finally {
      this.policeLoading = false;
    }
  }

  private async loadPyq() {
    const api: string = environment.apiUrl;
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: { owned?: boolean; years: PyqYear[] } }>(`${api}/tests/pyq`)
      );
      this.pyqYears = [...response.data.years].sort((a, b) => b.year - a.year);
      this.pyqOwned = Boolean(response.data.owned);
      if (!this.pyqYears.some((entry) => entry.year === this.pyqYear)) {
        this.pyqYear = this.pyqYears[0]?.year ?? 0;
      }
    } catch {
      this.pyqYears = [];
    } finally {
      this.pyqLoading = false;
    }
  }

  private async loadMocks() {
    const api: string = environment.apiUrl;
    try {
      const response = await firstValueFrom(this.http.get<{ data: { owned?: boolean; mocks: MockSummary[] } }>(`${api}/tests/mocks`));
      this.mocks = response.data.mocks;
      this.mockOwned = Boolean(response.data.owned);
    } catch {
      this.mocks = [];
    } finally {
      this.mocksLoading = false;
    }
  }

  private async loadCategories() {
    const api: string = environment.apiUrl;
    try {
      const response = await firstValueFrom(this.http.get<{ data: SubjectCategory[] }>(`${api}/tests/categories`));
      this.categories = response.data;
    } catch {
      this.categories = [];
    } finally {
      this.categoriesLoading = false;
    }
  }

  private async loadStats() {
    const api: string = environment.apiUrl;
    try {
      const response = await firstValueFrom(this.http.get<{ data: any }>(`${api}/dashboard/stats`));
      const { attemptedCount, testsCompleted, averageAccuracy, recentAttempts, activeAttempt } = response.data;
      this.stats = { attemptedCount, testsCompleted, averageAccuracy };
      this.activeAttempt = activeAttempt;

      const { outcomes, categoryStats } = response.data;
      this.outcomeSlices = [
        { label: 'Correct', value: outcomes.correct, color: '#34a96b' },
        { label: 'Incorrect', value: outcomes.incorrect, color: '#e0584f' },
        { label: 'Unanswered', value: outcomes.unanswered, color: '#b8c4d3' }
      ];
      this.recentBars = [...recentAttempts].reverse().map((attempt: any, index: number) => ({
        label: `Test ${index + 1}`,
        value: Math.round(attempt.percentage),
        caption: `${Math.round(attempt.percentage)}%`
      }));
      this.subjectBars = [...categoryStats].sort((a: any, b: any) => b.accuracy - a.accuracy).map((entry: any) => ({
        label: entry.category,
        value: entry.accuracy,
        color: '#9dbbe6',
        caption: `${entry.accuracy}%`
      }));
    } catch {
      // Keep zeros if stats are unavailable.
    }
  }

  logout() {
    this.auth.logout();
  }
}
