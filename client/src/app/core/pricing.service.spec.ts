import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { PackPrice, PricingService } from './pricing.service';

describe('PricingService package catalog', () => {
  let service: PricingService;
  let http: HttpTestingController;
  let signedIn: boolean;
  const snack = { open: jasmine.createSpy('open') };
  const bundle: PackPrice = {
    pack: 'complete', name: 'Complete preparation', description: 'All ADRE practice',
    perks: ['Subject practice', 'PYQ papers'], price: 600, originalPrice: 1000,
    enabled: true, visible: true, archived: false, highlight: true,
    group: 'adre', access: ['subject', 'pyq'], sortOrder: 6
  };

  beforeEach(() => {
    signedIn = false;
    snack.open.calls.reset();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: { apiBase: '/api', userSignal: () => signedIn ? { id: 'learner' } : null } },
        { provide: MatSnackBar, useValue: snack }
      ]
    });
    service = TestBed.inject(PricingService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses live metadata and filters hidden and archived packages from their collections', async () => {
    const loading = service.load();
    http.expectOne('/api/purchases/prices').flush({ data: [
      bundle, { ...bundle, pack: 'hidden', visible: false },
      { ...bundle, pack: 'archived', archived: true },
      { ...bundle, pack: 'police-bundle', group: 'police-forest' }
    ] });
    await loading;
    expect(service.plansFor('adre').map((plan) => plan.id)).toEqual(['complete']);
    expect(service.plansFor('police-forest').map((plan) => plan.id)).toEqual(['police-bundle']);
    expect(service.plansFor('adre')[0]).toEqual(jasmine.objectContaining({
      name: bundle.name, description: bundle.description, perks: bundle.perks, highlight: true
    }));
    expect(service.priceFor('complete')).toBe('₹600');
    expect(service.originalFor('complete')).toBe('₹1000');
    expect(service.savingsFor('complete')).toBe('40% OFF');
    expect(service.onSale(service.planFor(service.prices[1]))).toBeFalse();
    expect(service.onSale(service.planFor(service.prices[2]))).toBeFalse();
  });

  it('shows edited original-package metadata and respects an intentionally empty feature list', () => {
    const entry = { ...bundle, pack: 'subject', name: 'Renamed subject practice', perks: [] };
    expect(service.planFor(entry).name).toBe('Renamed subject practice');
    expect(service.planFor(entry).perks).toEqual([]);
    expect(service.planFor({ ...entry, perks: undefined }).perks.length).toBeGreaterThan(0);
  });

  it('tracks bundle purchases as well as unlocked content', async () => {
    signedIn = true;
    const loading = service.load();
    http.expectOne('/api/purchases').flush({ data: { packs: ['subject', 'pyq'], purchases: [{ pack: 'complete' }] } });
    await Promise.resolve();
    http.expectOne('/api/purchases/prices').flush({ data: [bundle] });
    await loading;
    expect(service.isOwned('complete')).toBeTrue();
    expect(service.isOwned('subject')).toBeTrue();
    expect(service.isOwned('mock')).toBeFalse();
    signedIn = false;
    expect(service.isOwned('complete')).toBeFalse();
  });

  it('fails closed and explicitly notifies when catalog loading fails', async () => {
    const loading = service.load();
    http.expectOne('/api/purchases/prices').flush({}, { status: 500, statusText: 'Server error' });
    await loading;
    expect(service.plansFor()).toEqual([]);
    expect(service.onSale(service.planFor(bundle))).toBeFalse();
    expect(service.error).toContain('Could not load packages');
    expect(snack.open).toHaveBeenCalled();
  });
});
