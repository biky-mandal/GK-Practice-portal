import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { PackPrice, PricingService } from '../../core/pricing.service';
import { ADRE_PLANS, PLANS, POLICE_PLANS } from '../../shared/pricing';
import { PoliceForestComponent } from './police-forest.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { routes } from '../../app.routes';

describe('Assam Police and Forest public page', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoliceForestComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: { userSignal: () => null } },
        { provide: PricingService, useValue: {
          load: jasmine.createSpy('load'),
          plansFor: () => POLICE_PLANS,
          priceFor: (pack: string) => pack === 'police-subject' ? '₹499' : '₹399',
          originalFor: () => null, savingsFor: () => null, isOwned: () => false, onSale: () => true
        } }
      ]
    }).compileComponents();
  });

  it('renders exactly two Test Series and clearly limits the mock scope', () => {
    const fixture = TestBed.createComponent(PoliceForestComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.plan').length).toBe(2);
    expect(Array.from(element.querySelectorAll<HTMLImageElement>('#police-pricing .plan img')).map((image) => image.getAttribute('src'))).toEqual([
      '/Assam-Police-Forest-Subject-Wise-Practice-Thumbnail.png',
      '/Assam-Police-Forest-10-Full-Length-Mock-Tests-Thumbnail.png'
    ]);
    expect(element.textContent).not.toMatch(/\bpackages?\b/i);
    expect(element.querySelector('.actions button')?.textContent).toContain('Explore 2 Test Series');
    expect(element.textContent).toContain('SI/Forest-specific patterns are not included yet');
    expect(element.textContent).toContain('90-minute practice timer');
    expect(element.textContent).toContain('not an official exam duration');
    expect(element.querySelectorAll('.plan a')[0].getAttribute('href')).toBe('/checkout/police-subject');
    expect(element.querySelectorAll('.plan a')[1].getAttribute('href')).toBe('/checkout/police-mock');
  });

  it('keeps ADRE plans separate while checkout and landing pricing include all five', () => {
    expect(ADRE_PLANS.map((plan) => plan.id)).toEqual(['subject', 'pyq', 'mock']);
    expect(POLICE_PLANS.map((plan) => plan.id)).toEqual(['police-subject', 'police-mock']);
    expect(PLANS.length).toBe(5);
    const seo = routes.find((route) => route.path === 'assam-police-forest')?.data?.['seo'];
    expect(seo.canonicalPath).toBe('/assam-police-forest');
    expect(seo.indexable).toBeTrue();
  });

  it('scrolls to its own pricing section without navigating away', () => {
    const fixture = TestBed.createComponent(PoliceForestComponent);
    fixture.detectChanges();
    const section: HTMLElement = fixture.nativeElement.querySelector('#police-pricing');
    spyOn(document, 'getElementById').and.returnValue(section);
    const scroll = spyOn(section, 'scrollIntoView');
    (fixture.nativeElement.querySelector('.actions button') as HTMLButtonElement).click();
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});

describe('Assam Police and Forest dashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DashboardComponent],
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: { isAdmin: () => false, isAuthenticated: () => true, apiBase: '/api',
          loadProfile: () => Promise.resolve({}), clearSession: () => undefined } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  const setup = () => {
    spyOn(DashboardComponent.prototype, 'ngOnInit');
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.pricing.prices = PLANS.map((plan): PackPrice => ({
      pack: plan.id, name: plan.name, price: 499, enabled: true, description: '', perks: plan.perks,
      group: plan.id.startsWith('police-') ? 'police-forest' : 'adre', access: [plan.id],
      visible: true, archived: false, highlight: plan.highlight, sortOrder: 0
    }));
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    component.tier = 'member';
    component.view = 'practice';
    return { fixture, component, router };
  };

  it('renders new bundles in Practice and removes hidden and archived offers', () => {
    const { fixture, component } = setup();
    const bundle: PackPrice = {
      pack: 'complete', name: 'Complete preparation', description: 'A new bundle',
      perks: ['Both practice modes'], price: 600, enabled: true, visible: true,
      archived: false, highlight: false, group: 'adre', access: ['subject', 'pyq'], sortOrder: 6
    };
    component.pricing.prices.push(bundle);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Complete preparation');
    expect(fixture.nativeElement.textContent).toContain('A new bundle');
    expect(fixture.nativeElement.querySelector('a[href="/dashboard/item/complete"]')).not.toBeNull();
    bundle.visible = false;
    expect(component.listedPacks).not.toContain('complete');
    bundle.visible = true;
    bundle.archived = true;
    expect(component.listedPacks).not.toContain('complete');
  });

  it('keeps owned archived content accessible in Practice and its detail page', () => {
    const { component } = setup();
    const subject = component.pricing.prices.find((row) => row.pack === 'subject')!;
    subject.archived = true;
    subject.visible = false;
    component.subjectOwned = true;
    expect(component.listedPacks).toContain('subject');
    expect(component.showPack('subject')).toBeFalse();
    component.selectedPack = 'subject';
    expect(component.showPack('subject')).toBeTrue();
    expect(component.canBuy('subject')).toBeFalse();
  });

  it('does not treat an ADRE purchase as ownership of either new package', () => {
    const { component } = setup();
    component.subjectOwned = true;
    component.mockOwned = true;
    expect(component.ownsPack('police-subject')).toBeFalse();
    expect(component.ownsPack('police-mock')).toBeFalse();
    expect(component.ownsPack('unknown')).toBeFalse();
    expect(component.ownsPack('constructor')).toBeFalse();
    expect(component.visiblePackCount).toBe(5);
    component.policeSubjectOwned = true;
    expect(component.listedPacks).toContain('police-subject');
    expect(component.visiblePackCount).toBe(5);
  });

  it('requires 100 questions and ownership before confirming a police mock', () => {
    const { component, router } = setup();
    component.policeMockOwned = true;
    component.askPoliceMock({ number: 1, title: 'Mock 1', count: 99 });
    expect(component.pending).toBeNull();
    component.askPoliceMock({ number: 1, title: 'Mock 1', count: 101 });
    expect(component.pending).toBeNull();
    component.askPoliceMock({ number: 1, title: 'Mock 1', count: 100 });
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], { queryParams: { new: 1, exam: 'police-forest', mock: 1 } });
  });

  it('sends the exam and selected categories for subject practice', () => {
    const { component, router } = setup();
    component.policeSubjectOwned = true;
    component.policeQuestionCount = 20;
    component.policeSelected.add('Polity');
    component.startPolicePractice();
    component.confirmPending();
    expect(router.navigate).toHaveBeenCalledWith(['/practice', 'gk'], {
      queryParams: { new: 1, exam: 'police-forest', count: 20, categories: 'Polity' }
    });
  });

  it('opens each Police and Forest header on its own detail page', () => {
    const { fixture, component } = setup();
    const element: HTMLElement = fixture.nativeElement;
    for (const id of ['police-subject', 'police-mock']) {
      component.selectedPack = id;
      fixture.detectChanges();
      const header = element.querySelector<HTMLElement>(`#${id} .pyq-hero`)!;
      const button = header.querySelector<HTMLElement>('.buy-btn')!;
      expect(header.textContent).toContain(component.packName(id));
      expect(getComputedStyle(button).backgroundColor).toBe('rgb(255, 255, 255)');
      expect(element.querySelector('#mock')).toBeNull();
    }
  });

  it('renders consistent buy buttons and price badges for all five Test Series, including free prices', () => {
    const { fixture, component } = setup();
    component.prices = { subject: 499, pyq: 299, mock: 399, 'police-subject': 499, 'police-mock': 0 };
    const element: HTMLElement = fixture.nativeElement;
    for (const plan of PLANS) {
      component.selectedPack = plan.id;
      fixture.detectChanges();
      const buttons = element.querySelectorAll<HTMLElement>('.buy-btn');
      expect(buttons.length).toBe(1);
      const button = buttons[0];
      expect(button.textContent).toContain('🛒 Buy');
      expect(getComputedStyle(button).backgroundColor).toBe('rgb(255, 255, 255)');
      expect(button.querySelector('.buy-price')).not.toBeNull();
      expect(button.getAttribute('type')).toBe('button');
    }
    expect(element.querySelector('#police-mock .buy-price')?.textContent).toBe('₹0');
  });

  it('lists owned and unowned police packages together and opens only the selected detail', () => {
    const { fixture, component } = setup();
    component.policeSubjectOwned = true;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href="/dashboard/item/police-subject"] .owned')).not.toBeNull();
    expect(element.querySelector('a[href="/dashboard/item/police-mock"] .price')).not.toBeNull();
    expect(element.querySelector('#police-subject')).toBeNull();
    expect(element.querySelector('#police-mock')).toBeNull();
    component.selectedPack = 'police-mock';
    fixture.detectChanges();
    expect(element.querySelector('#police-subject')).toBeNull();
    expect(element.querySelector('#police-mock')).not.toBeNull();
  });
});
