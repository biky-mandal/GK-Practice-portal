import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Entitlements {
  isAdmin: boolean;
  tier: 'admin' | 'guest' | 'member';
  packs: string[];
  purchases: Array<{ pack: string; amount: number; purchasedAt: string; access?: string[] }>;
  prices: Record<string, number>;
}

export interface RazorpayOrder {
  free: boolean;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  entitlements?: Entitlements;
}

@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  constructor(private readonly http: HttpClient) { }

  async load(): Promise<Entitlements> {
    const response = await firstValueFrom(this.http.get<{ data: Entitlements }>(`${this.apiBase}/purchases`));
    return response.data;
  }

  async createOrder(pack: string) {
    const response = await firstValueFrom(this.http.post<{ data: RazorpayOrder }>(`${this.apiBase}/purchases/order`, { pack }));
    return response.data;
  }

  async verifyPayment(payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const response = await firstValueFrom(this.http.post<{ data: Entitlements }>(`${this.apiBase}/purchases/verify`, payment));
    return response.data;
  }

  private get apiBase(): string {
    return environment.apiUrl;
  }
}
