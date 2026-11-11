import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { PLANS, PricingPlan } from '../shared/pricing';

export interface PackPrice {
  pack: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  enabled: boolean;
  description: string;
  perks?: string[];
  group: 'adre' | 'police-forest';
  access: string[];
  contentOptions?: string[];
  visible: boolean;
  archived: boolean;
  highlight: boolean;
  sortOrder: number;
}

// The live catalog controls visibility; static plans only supply legacy feature text.
@Injectable({ providedIn: 'root' })
export class PricingService {
  prices: PackPrice[] = [];
  ownedPacks: string[] = [];
  loaded = false;
  error = '';

  constructor(private readonly http: HttpClient, private readonly auth: AuthService, private readonly snack: MatSnackBar) {}

  planFor(entry: PackPrice): PricingPlan {
    const fallback = PLANS.find((plan) => plan.id === entry.pack);
    return {
      id: entry.pack, name: entry.name, description: entry.description,
      price: `₹${entry.price}`, period: 'one-time payment',
      highlight: entry.highlight, cta: fallback?.cta ?? 'Buy Test Series',
      perks: entry.perks ?? fallback?.perks ?? []
    };
  }

  plansFor(group?: PackPrice['group']): PricingPlan[] {
    return this.prices.filter((entry) => entry.visible && !entry.archived && (!group || entry.group === group))
      .map((entry) => this.planFor(entry));
  }

  isOwned(pack: string): boolean {
    return !!this.auth.userSignal() && this.ownedPacks.includes(pack);
  }

  async load() {
    this.error = '';
    this.loaded = false;
    this.ownedPacks = [];
    if (this.auth.userSignal()) {
      try {
        const owned = await firstValueFrom(this.http.get<{ data: { packs: string[]; purchases: Array<{ pack: string }> } }>(`${this.auth.apiBase}/purchases`));
        this.ownedPacks = [...owned.data.packs, ...owned.data.purchases.map((purchase) => purchase.pack)];
      } catch {
        this.ownedPacks = [];
        this.snack.open('Could not load your purchases. Please reload to check package ownership.', 'Close', { duration: 6000 });
      }
    }
    try {
      const response = await firstValueFrom(this.http.get<{ data: PackPrice[] }>(`${this.auth.apiBase}/purchases/prices`));
      this.prices = response.data;
      this.loaded = true;
    } catch {
      this.prices = [];
      this.error = 'Could not load packages. Please try again.';
      this.snack.open(this.error, 'Close', { duration: 6000 });
    }
  }

  priceFor(pack: string): string {
    const entry = this.prices.find((price) => price.pack === pack);
    return entry ? `₹${entry.price}` : '...';
  }

  // The struck-through list price, only when the admin set one above the selling price.
  originalFor(pack: string): string | null {
    const entry = this.prices.find((price) => price.pack === pack);
    return entry?.originalPrice && entry.originalPrice > entry.price ? `₹${entry.originalPrice}` : null;
  }

  savingsFor(pack: string): string | null {
    const entry = this.prices.find((price) => price.pack === pack);
    if (!entry?.originalPrice || entry.originalPrice <= entry.price) return null;
    return `${Math.round(((entry.originalPrice - entry.price) / entry.originalPrice) * 100)}% OFF`;
  }

  onSale(plan: PricingPlan): boolean {
    const entry = this.prices.find((price) => price.pack === plan.id);
    return !!entry && entry.enabled && entry.visible && !entry.archived;
  }
}
