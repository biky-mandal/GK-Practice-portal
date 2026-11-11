import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { PricingService } from '../../core/pricing.service';
import { AdreComponent } from './adre.component';
import { ADRE_PLANS } from '../../shared/pricing';

describe('AdreComponent', () => {
  const owned = new Set<string>();
  const disabled = new Set<string>();
  let signedIn = false;

  beforeEach(async () => {
    owned.clear();
    disabled.clear();
    signedIn = false;
    await TestBed.configureTestingModule({
      declarations: [AdreComponent],
      imports: [RouterTestingModule, MatButtonModule],
      providers: [
        { provide: AuthService, useValue: { userSignal: () => signedIn ? { id: 'learner' } : null } },
        { provide: PricingService, useValue: {
          load: jasmine.createSpy('load'),
          plansFor: () => ADRE_PLANS,
          priceFor: () => '₹499',
          originalFor: () => null,
          savingsFor: () => null,
          isOwned: (id: string) => owned.has(id),
          onSale: (plan: { id: string }) => !disabled.has(plan.id)
        } }
      ]
    }).compileComponents();
  });

  it('renders the three ADRE Test Series without Police and Forest products', () => {
    const fixture = TestBed.createComponent(AdreComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelectorAll('#pricing .plan').length).toBe(3);
    expect(Array.from(element.querySelectorAll<HTMLImageElement>('#pricing .plan img')).map((image) => image.getAttribute('src'))).toEqual([
      '/ADRE-3.0-Subject-Wise-Practice-Thumbnail.png',
      '/ADRE-PYQ-Practice-ADRE-1.0-2.0-Thumbnail.png',
      '/ADRE-3.0-10-Full-Length-Mock-Tests-Thumbnail.png'
    ]);
    expect(element.querySelector('.plan-police-subject')).toBeNull();
    expect(element.querySelectorAll('.pyq-year').length).toBe(2);
    expect(element.querySelectorAll('.pyq-year li').length).toBe(10);
    expect(element.querySelector('.price-chip')?.textContent).not.toContain('onwards');
  });

  it('switches all five paper patterns and exposes the selected button', () => {
    const fixture = TestBed.createComponent(AdreComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(element.querySelectorAll<HTMLButtonElement>('.tab'));
    expect(tabs.length).toBe(5);
    tabs.forEach((tab, index) => {
      tab.click();
      fixture.detectChanges();
      const paper = fixture.componentInstance.papers[index];
      expect(element.querySelector('#paper-details h3')?.textContent).toContain(paper.name);
      expect(element.querySelector('.paper-stats')?.textContent).toContain(String(paper.marks));
      expect(tab.getAttribute('aria-pressed')).toBe('true');
      expect(element.querySelectorAll('.tab[aria-pressed="true"]').length).toBe(1);
      expect(element.querySelectorAll('.marks-table tbody tr').length).toBe(paper.breakdown ? paper.breakdown.length + 1 : 0);
    });
  });

  it('retains owned and disabled sale states and checkout destinations', () => {
    owned.add('subject');
    disabled.add('mock');
    const fixture = TestBed.createComponent(AdreComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.plan-subject')?.textContent).toContain('Purchased');
    expect(element.querySelector('.plan-subject button[routerLink]')?.getAttribute('routerLink')).toBe('/dashboard');
    expect(element.querySelector('.plan-pyq button')?.getAttribute('ng-reflect-router-link')).toBe('/checkout,pyq');
    expect(element.querySelector<HTMLButtonElement>('.plan-mock button')?.disabled).toBeTrue();
    expect(element.querySelector('.plan-mock button')?.textContent).toContain('Not on sale');
  });

  it('scrolls the hero action to pricing and the section navigation to its destination', () => {
    const fixture = TestBed.createComponent(AdreComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const pricing = element.querySelector<HTMLElement>('#pricing')!;
    const pattern = element.querySelector<HTMLElement>('#pattern')!;
    const find = spyOn(document, 'getElementById').and.returnValue(pricing);
    const pricingScroll = spyOn(pricing, 'scrollIntoView');
    element.querySelector<HTMLButtonElement>('.hero-cta .cta')!.click();
    expect(pricingScroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    find.and.returnValue(pattern);
    const patternScroll = spyOn(pattern, 'scrollIntoView');
    element.querySelectorAll<HTMLButtonElement>('.page-nav button')[1].click();
    expect(patternScroll).toHaveBeenCalled();
  });

  it('provides native expandable FAQs and correct guest/member start links', () => {
    const fixture = TestBed.createComponent(AdreComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('#faq details').length).toBe(fixture.componentInstance.faqs.length);
    expect(fixture.componentInstance.startLink).toBe('/login');
    signedIn = true;
    fixture.detectChanges();
    expect(fixture.componentInstance.startLink).toBe('/dashboard');
    expect(element.querySelector('.hero-cta .ghost')?.textContent).toContain('Open dashboard');
  });
});
