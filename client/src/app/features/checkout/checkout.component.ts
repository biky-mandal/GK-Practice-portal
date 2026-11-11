import { HttpErrorResponse } from '@angular/common/http';
import { Component, NgZone, OnInit, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { EntitlementsService, Entitlements } from '../../core/entitlements.service';
import { PricingService } from '../../core/pricing.service';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const loadCheckoutScript = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window.'));
    document.body.appendChild(script);
  });

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly entitlements = inject(EntitlementsService);
  private readonly zone = inject(NgZone);
  readonly pricing = inject(PricingService);

  readonly pack = this.route.snapshot.paramMap.get('pack') ?? '';
  get examLink() { return this.entry?.group === 'police-forest' ? '/assam-police-forest' : '/adre'; }
  get examLabel() { return this.entry?.group === 'police-forest' ? 'Assam Police and Forest' : 'ADRE 3.0'; }
  get entry() { return this.pricing.prices.find((entry) => entry.pack === this.pack); }
  get available() { return !!this.entry && this.pricing.onSale(this.pricing.planFor(this.entry)); }
  state: Entitlements | null = null;
  paying = false;

  get plan() {
    return this.entry ? this.pricing.planFor(this.entry) : undefined;
  }

  get price(): number | null {
    return this.entry?.price ?? null;
  }

  get owned(): boolean {
    return Boolean(this.state?.isAdmin || this.state?.packs.includes(this.pack) || this.state?.purchases.some((p) => p.pack === this.pack));
  }

  async ngOnInit() {
    await this.pricing.load();
    try {
      this.state = await this.entitlements.load();
    } catch {
      this.snack.open('Could not load your purchases. Please reload before paying.', 'Close');
    }
  }

  async pay() {
    if (this.paying || this.owned || !this.available || !this.state) return;
    this.paying = true;
    try {
      const order = await this.entitlements.createOrder(this.pack);
      if (order.free) {
        this.finish();
        return;
      }

      await loadCheckoutScript();
      const checkout = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: '#173b5b' },
        // Razorpay calls back outside Angular, so re-enter the zone to update the UI.
        handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
          this.zone.run(() => this.confirm(response)),
        modal: { ondismiss: () => this.zone.run(() => (this.paying = false)) }
      });
      checkout.on('payment.failed', (event: { error?: { description?: string } }) =>
        this.zone.run(() => {
          this.paying = false;
          this.snack.open(event.error?.description ?? 'Payment failed. You have not been charged.', 'Close');
        })
      );
      checkout.open();
    } catch (error) {
      this.paying = false;
      const message = error instanceof HttpErrorResponse ? error.error?.message : (error as Error)?.message;
      this.snack.open(message ?? 'Could not start the payment.', 'Close');
    }
  }

  private async confirm(response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    try {
      await this.entitlements.verifyPayment(response);
      this.finish();
    } catch (error) {
      this.paying = false;
      const message = error instanceof HttpErrorResponse ? error.error?.message : null;
      this.snack.open(`${message ?? 'We could not confirm the payment yet.'} If you were charged, access is added automatically within a few minutes.`, 'Close', { duration: 8000 });
    }
  }

  private finish() {
    this.paying = false;
    this.snack.open(`${this.plan?.name ?? 'Test Series'} unlocked.`, 'Close');
    this.router.navigateByUrl('/dashboard');
  }
}
