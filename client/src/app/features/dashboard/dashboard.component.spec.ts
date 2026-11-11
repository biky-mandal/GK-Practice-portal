import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/auth.service';
import { EntitlementsService } from '../../core/entitlements.service';
import { PackPrice, PricingService } from '../../core/pricing.service';
import { PLANS } from '../../shared/pricing';

const papers = (counts: number[]) =>
  [
    { id: 'g3-p3', grade: 'Grade-III', paper: 'Paper-III', level: 'HSSLC' },
    { id: 'g3-p4', grade: 'Grade-III', paper: 'Paper-IV', level: 'Degree' },
    { id: 'g3-p5', grade: 'Grade-III', paper: 'Paper-V', level: 'Driver' },
    { id: 'g4-p1', grade: 'Grade-IV', paper: 'Paper-I', level: 'HSLC' },
    { id: 'g4-p2', grade: 'Grade-IV', paper: 'Paper-II', level: 'Class VIII' }
  ].map((paper, index) => ({ ...paper, count: counts[index] }));

const price = (pack: string, amount: number, sortOrder: number): PackPrice => ({
  pack, name: PLANS.find((plan) => plan.id === pack)?.name ?? pack, price: amount, enabled: true, description: '',
  group: pack.startsWith('police-') ? 'police-forest' : 'adre', access: [pack], visible: true, archived: false, highlight: false, sortOrder
});

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let http: HttpTestingController;
  let router: Router;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const setup = async (route: { pack?: string; view?: string }, loggedIn = true) => {
    params = new BehaviorSubject(convertToParamMap(route.pack ? { pack: route.pack } : {}));
    queryParams = new BehaviorSubject(convertToParamMap(route.view ? { view: route.view } : {}));
    const prices = [price('subject', 499, 1), price('pyq', 299, 2), price('mock', 399, 3)];

    await TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      imports: [RouterTestingModule, HttpClientTestingModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: queryParams } },
        { provide: AuthService, useValue: {
          loadProfile: jasmine.createSpy('loadProfile').and.resolveTo({}), clearSession: jasmine.createSpy('clearSession'),
          logout: jasmine.createSpy('logout'), isAdmin: () => false, isAuthenticated: () => loggedIn, apiBase: '/api'
        } },
        { provide: EntitlementsService, useValue: {
          load: jasmine.createSpy('load').and.resolveTo({ isAdmin: false, tier: 'member', packs: ['pyq'], purchases: [], prices: { subject: 499, pyq: 299, mock: 399 } })
        } },
        { provide: PricingService, useValue: {
          prices, loaded: true, load: jasmine.createSpy('load').and.resolveTo(undefined),
          planFor: (entry: PackPrice) => ({ ...PLANS.find((plan) => plan.id === entry.pack)!, description: entry.description }),
          originalFor: () => null, priceFor: (pack: string) => `₹${prices.find((entry) => entry.pack === pack)?.price}`
        } }
      ]
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    http.match((r) => r.url.endsWith('/tests/daily-free')).forEach((r) => r.flush({ data: { status: 'available', questionCount: 10 } }));
    await fixture.whenStable();
    http.match((r) => r.url.endsWith('/tests/pyq')).forEach((r) => r.flush({
      data: { owned: loggedIn, years: [{ year: 2022, papers: papers([120, 90, 40, 100, 80]) }, { year: 2024, papers: papers([50, 0, 0, 0, 0]) }] }
    }));
    http.match((r) => r.url.endsWith('/tests/mocks')).forEach((r) => r.flush({ data: { owned: false, mocks: [] } }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const el = () => fixture.nativeElement as HTMLElement;
  const itemCards = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('[data-testid="item-card"]'));

  it('shows owned and unowned brief cards together under Practice', async () => {
    await setup({ view: 'practice' });

    expect(el().querySelector('#pyq')).toBeNull();
    expect(itemCards().map((card) => card.getAttribute('href'))).toEqual([
      '/dashboard/item/subject', '/dashboard/item/pyq', '/dashboard/item/mock'
    ]);
    expect(itemCards()[1].querySelector('.item-name')?.textContent).toContain('ADRE 1.0 (2022) & ADRE 2.0 (2024) PYQ Practice');
    expect(itemCards()[1].querySelector('.item-chip')?.textContent).toContain('Unlocked');
    expect(itemCards()[0].querySelector('.item-chip')?.textContent).toContain('₹499');
    expect(itemCards().map((card) => card.querySelector('.item-image')?.getAttribute('src'))).toEqual([
      '/ADRE-3.0-Subject-Wise-Practice-Thumbnail.png',
      '/ADRE-PYQ-Practice-ADRE-1.0-2.0-Thumbnail.png',
      '/ADRE-3.0-10-Full-Length-Mock-Tests-Thumbnail.png'
    ]);
    const tabs = Array.from(el().querySelectorAll('.dash-menu button')).map((button) => button.textContent);
    expect(tabs.length).toBe(3);
    expect(tabs[0]).toContain('Progress');
    expect(tabs[1]).toContain('Practice');
    expect(tabs[2]).toContain('Recent Tests');
    expect(el().querySelector('#daily')).not.toBeNull();
  });

  it('uses the matching thumbnail for both Assam Police packages', async () => {
    await setup({ view: 'practice' });

    expect(component.brief('police-subject').image).toBe('/Assam-Police-Forest-Subject-Wise-Practice-Thumbnail.png');
    expect(component.brief('police-mock').image).toBe('/Assam-Police-Forest-10-Full-Length-Mock-Tests-Thumbnail.png');
  });

  it('opens the combined Practice list for legacy tab links', async () => {
    await setup({ view: 'other' });

    expect(component.view).toBe('practice');
    expect(itemCards().length).toBe(3);
    queryParams.next(convertToParamMap({ view: 'purchased' }));
    fixture.detectChanges();
    expect(component.view).toBe('practice');
    expect(itemCards().length).toBe(3);
    expect(el().querySelector('.pyq-perks')).toBeNull();
  });

  it('shows the full pack information on its detail page and starts a paper', async () => {
    await setup({ pack: 'pyq' });

    expect(itemCards().length).toBe(0);
    const section = el().querySelector('#pyq') as HTMLElement;
    expect(section.querySelector('.pyq-perks')?.textContent).toContain('10 full papers');
    expect(Array.from(section.querySelectorAll('.lang-toggle button')).map((b) => b.textContent?.trim())).toEqual(['ADRE 2.0 (2024)', 'ADRE 1.0 (2022)']);
    expect(el().querySelector('.back-link')?.textContent).toContain('Back to Practice');
    expect(el().querySelector('#mock')).toBeNull();

    (section.querySelectorAll('[data-testid="pyq-paper"]')[0] as HTMLElement).click();
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, pyqYear: 2024, pyqPaper: 'g3-p3' } });
  });

  it('returns to Practice from an unowned item detail page', async () => {
    await setup({ pack: 'mock' });

    expect(el().querySelector('#mock')).not.toBeNull();
    (el().querySelector('.back-link') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { queryParams: { view: 'practice' } });
  });

  it('reports packs that are not available', async () => {
    await setup({ pack: 'unknown' });

    expect(el().querySelector('.empty-state')?.textContent).toContain('not available');
  });

  it('lets guests browse packages without loading private data', async () => {
    await setup({}, false);
    expect(component.view).toBe('practice');
    expect(itemCards().length).toBe(3);
    expect(component.showProgress).toBeFalse();
    expect(TestBed.inject(AuthService).loadProfile).not.toHaveBeenCalled();
    expect(TestBed.inject(EntitlementsService).load).not.toHaveBeenCalled();
    expect(el().textContent).not.toContain('Recent Tests');
    http.expectNone((request) => request.url.endsWith('/dashboard/stats') || request.url.endsWith('/dashboard/recent-attempts') || request.url.endsWith('/tests/daily-free'));
  });

  it('shows recent completed tests on a separate tab and links to the result', async () => {
    await setup({});
    expect(el().textContent).not.toContain('Recent test results');
    component.setView('results');
    fixture.detectChanges();
    expect(el().textContent).toContain('Loading recent tests');
    http.expectOne((request) => request.url.endsWith('/dashboard/recent-attempts')).flush({ data: [
      { id: 'attempt-1', score: 2, percentage: 50, submittedAt: '2026-11-05T00:00:00Z', totalQuestions: 4, mock: 1, exam: 'police-forest' }
    ] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('.result-entry')?.textContent).toContain('Assam Police and Forest · Mock 1');
    expect(el().querySelector('.result-entry')?.textContent).toContain('Score: 2');
    expect(el().querySelector<HTMLAnchorElement>('.result-entry a')?.getAttribute('href')).toContain('/result/attempt-1');
    expect(el().querySelector<HTMLAnchorElement>('.result-entry a')?.getAttribute('href')).toContain('from=recent-tests');
  });

  it('opens the results tab from a link and allows retrying a failed history request', async () => {
    await setup({ view: 'results' });
    http.expectOne((request) => request.url.endsWith('/dashboard/recent-attempts')).flush('error', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Could not load recent tests');
    (el().querySelector('[role="alert"] button') as HTMLButtonElement).click();
    http.expectOne((request) => request.url.endsWith('/dashboard/recent-attempts')).flush({ data: [] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain('No completed tests yet');
  });

  it('offers only the first PYQ paper free to a guest', async () => {
    await setup({ pack: 'pyq' }, false);
    const cards = el().querySelectorAll<HTMLElement>('[data-testid="pyq-paper"]');
    expect(cards[0].classList.contains('locked')).toBeFalse();
    expect(cards[1].classList.contains('locked')).toBeTrue();
    cards[0].click();
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, pyqYear: 2024, pyqPaper: 'g3-p3' } });
    component.pyqYear = 2022;
    component.askPyq(component.pyqPapers[0]);
    expect(component.pending).toBeNull();
  });

  it('offers Mock 1 but keeps later mocks locked without a purchase', async () => {
    await setup({ pack: 'mock' }, false);
    component.mocks = [1, 2].map((number) => ({ number, title: `Mock ${number}`, count: 10 }));
    fixture.detectChanges();
    const cards = el().querySelectorAll<HTMLElement>('[data-testid="mock-test"]');
    expect(cards[0].textContent).toContain('Free');
    expect(cards[1].classList.contains('locked')).toBeTrue();
    component.askMock(component.mocks[1]);
    expect(component.pending).toBeNull();
    cards[0].click();
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, mock: 1 } });
  });

  it('lets non-purchasers practise only the free subject', async () => {
    await setup({ pack: 'subject' }, false);
    http.match((r) => r.url.endsWith('/tests/categories') && !r.params.has('exam')).forEach((r) => r.flush({
      data: [{ name: 'Assam Polity', count: 30, free: true }, { name: 'Polity', count: 40, free: false }]
    }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.categoriesLoading).toBeFalse();
    expect(component.freeCategory).toBe('Assam Polity');
    const cards = el().querySelectorAll<HTMLButtonElement>('#practice .cat-card');
    expect(cards[0].disabled).toBeFalse();
    expect(cards[0].textContent).toContain('Free');
    expect(cards[1].disabled).toBeTrue();
    expect(cards[1].classList.contains('locked')).toBeTrue();
    component.toggle('Polity');
    expect(component.selected.size).toBe(0);

    component.questionCount = 20;
    component.startPractice();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, count: 20, categories: 'Assam Polity' } });

    component.policeCategories = [{ name: 'Assam Polity', count: 5, free: true }, { name: 'Reasoning', count: 5 }];
    component.startPolicePractice();
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, exam: 'police-forest', count: 10, categories: 'Assam Polity' } });
  });

  it('shows a loading state until subjects arrive', async () => {
    await setup({ pack: 'subject' });
    expect(el().querySelector('#practice .section-loading')?.textContent).toContain('Loading subjects');
    http.match((r) => r.url.endsWith('/tests/categories') && !r.params.has('exam')).forEach((r) => r.flush({ data: [] }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().querySelector('#practice .section-loading')).toBeNull();
  });
});
