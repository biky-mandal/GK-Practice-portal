import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { PricingService } from '../../core/pricing.service';
import { LandingComponent } from './landing.component';
import { ADRE_PLANS, POLICE_PLANS } from '../../shared/pricing';

describe('LandingComponent', () => {
  const owned = new Set<string>();
  const disabled = new Set<string>();
  let http: HttpTestingController;

  beforeEach(async () => {
    owned.clear();
    disabled.clear();
    await TestBed.configureTestingModule({
      declarations: [LandingComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatButtonModule],
      providers: [
        { provide: AuthService, useValue: { userSignal: () => null, apiBase: '/api' } },
        { provide: PricingService, useValue: {
          load: jasmine.createSpy('load'),
          plansFor: (group: string) => group === 'adre' ? ADRE_PLANS : POLICE_PLANS,
          priceFor: () => '₹499',
          originalFor: () => null,
          savingsFor: () => null,
          isOwned: (id: string) => owned.has(id),
          onSale: (plan: { id: string }) => !disabled.has(plan.id)
        } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders two distinct exam tracks and all five Test Series grouped by exam', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('.adre-spotlight a, .adre-spotlight button[routerLink]')?.getAttribute('routerLink')).toBe('/adre');
    expect(element.querySelector('.police-btn')?.getAttribute('href')).toBe('/assam-police-forest');
    const groups = element.querySelectorAll('.pricing-group');
    expect(groups.length).toBe(2);
    expect(groups[0].querySelectorAll('.plan').length).toBe(3);
    expect(groups[1].querySelectorAll('.plan').length).toBe(2);
    expect(Array.from(element.querySelectorAll<HTMLImageElement>('#pricing .plan img')).map((image) => image.getAttribute('src'))).toEqual([
      '/ADRE-3.0-Subject-Wise-Practice-Thumbnail.png',
      '/ADRE-PYQ-Practice-ADRE-1.0-2.0-Thumbnail.png',
      '/ADRE-3.0-10-Full-Length-Mock-Tests-Thumbnail.png',
      '/Assam-Police-Forest-Subject-Wise-Practice-Thumbnail.png',
      '/Assam-Police-Forest-10-Full-Length-Mock-Tests-Thumbnail.png'
    ]);
    expect(element.querySelector('.police-pattern')?.textContent).toContain('not an official duration');
    expect(element.querySelector('.police-pattern')?.textContent).toContain('SI/Forest-specific patterns are not included yet');
  });

  it('preserves purchase, owned and disabled sale states', () => {
    owned.add('subject');
    disabled.add('police-mock');
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#pricing .plan-subject')?.textContent).toContain('Purchased');
    expect(element.querySelector('.plan-subject button[routerLink]')?.getAttribute('routerLink')).toBe('/dashboard');
    const buyButton = element.querySelector<HTMLButtonElement>('.plan-police-mock button')!;
    expect(buyButton.disabled).toBeTrue();
    expect(buyButton.textContent).toContain('Not on sale');
    expect(element.querySelector('.plan-pyq button')?.getAttribute('ng-reflect-router-link')).toBe('/checkout,pyq');
  });

  it('scrolls the hero action to the exam tracks', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const section: HTMLElement = fixture.nativeElement.querySelector('#exam-tracks');
    spyOn(document, 'getElementById').and.returnValue(section);
    const scroll = spyOn(section, 'scrollIntoView');
    (fixture.nativeElement.querySelector('.hero-cta button:last-child') as HTMLButtonElement).click();
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('preserves contact submission and exposes success as a status message', async () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const reset = spyOn(form, 'reset');
    const submitted = fixture.componentInstance.sendMessage(new Event('submit'), form, 'Learner', 'learner@example.com', 'Tell me more about the Test Series.');
    const request = http.expectOne('/api/contact');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.name).toBe('Learner');
    request.flush({ success: true });
    await submitted;
    fixture.detectChanges();
    expect(reset).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Your message has been sent');
  });

  it('shows contact errors instead of a success message', async () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const submitted = fixture.componentInstance.sendMessage(new Event('submit'), form, 'Learner', 'learner@example.com', 'Question');
    http.expectOne('/api/contact').flush({ message: 'Please try again later.' }, { status: 503, statusText: 'Unavailable' });
    await submitted;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Please try again later.');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
});
