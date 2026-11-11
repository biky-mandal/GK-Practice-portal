import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { EntitlementsService } from '../../core/entitlements.service';
import { PackPrice, PricingService } from '../../core/pricing.service';
import { CheckoutComponent } from './checkout.component';

describe('CheckoutComponent dynamic packages', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let entry: PackPrice;
  let pricing: { prices: PackPrice[]; loaded: boolean; error: string; load: jasmine.Spy; onSale: jasmine.Spy; planFor: jasmine.Spy };
  let entitlements: { load: jasmine.Spy; createOrder: jasmine.Spy };
  const snack = { open: jasmine.createSpy('open') };

  beforeEach(async () => {
    entry = {
      pack: 'complete', name: 'Complete preparation', description: 'Everything in one bundle',
      perks: ['Subject practice', 'PYQ'], price: 600, enabled: true, visible: true,
      archived: false, highlight: true, group: 'police-forest', access: ['subject', 'pyq'], sortOrder: 6
    };
    pricing = {
      prices: [entry], loaded: true, error: '', load: jasmine.createSpy('load').and.resolveTo(),
      onSale: jasmine.createSpy('onSale').and.callFake(() => entry.enabled && entry.visible && !entry.archived),
      planFor: jasmine.createSpy('planFor').and.callFake(() => ({ ...entry, id: entry.pack }))
    };
    entitlements = {
      load: jasmine.createSpy('load').and.resolveTo({ isAdmin: false, tier: 'guest', packs: [], purchases: [], prices: {} }),
      createOrder: jasmine.createSpy('createOrder').and.resolveTo({ free: true })
    };
    await TestBed.configureTestingModule({
      declarations: [CheckoutComponent], imports: [CommonModule, RouterTestingModule, MatButtonModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ pack: 'complete' }) } } },
        { provide: PricingService, useValue: pricing },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: MatSnackBar, useValue: snack }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders new package metadata, live price and collection link without static catalog entries', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe(entry.name);
    expect(fixture.nativeElement.textContent).toContain(entry.description);
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(2);
    expect(fixture.componentInstance.price).toBe(600);
    expect(fixture.componentInstance.examLink).toBe('/assam-police-forest');
    expect((fixture.nativeElement.querySelector('.pay') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('disables archived packages and refuses to create an order', async () => {
    entry.archived = true;
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.pay') as HTMLButtonElement).disabled).toBeTrue();
    await fixture.componentInstance.pay();
    expect(entitlements.createOrder).not.toHaveBeenCalled();
  });

  it('recognizes bundle ownership and prevents repeat purchases', async () => {
    entitlements.load.and.resolveTo({ isAdmin: false, packs: ['subject', 'pyq'], purchases: [{ pack: 'complete' }] });
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.pay') as HTMLButtonElement).disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Already purchased');
  });
});
