import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { PricingService } from '../../core/pricing.service';
import { packageImageFor } from '../../shared/package-images';
import { NO_SUBSCRIPTION_NOTE } from '../../shared/pricing';

@Component({
  selector: 'app-police-forest',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule],
  templateUrl: './police-forest.component.html',
  styleUrls: ['./police-forest.component.css']
})
export class PoliceForestComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly pricing = inject(PricingService);
  readonly packageImageFor = packageImageFor;
  get plans() { return this.pricing.plansFor('police-forest'); }
  readonly note = NO_SUBSCRIPTION_NOTE;
  readonly subjects = [
    { name: 'Elementary Arithmetic', text: 'Build confidence with numbers, percentages, ratios, averages and everyday calculations.' },
    { name: 'General English', text: 'Practise grammar, vocabulary and comprehension at secondary-school level.' },
    { name: 'Reasoning and Mental Ability', text: 'Work on patterns, logical thinking, series and problem solving.' },
    { name: 'Assam Knowledge', text: 'Revise Assam history, geography, polity and economy.' },
    { name: 'General Awareness', text: 'Strengthen general knowledge and current-affairs preparation.' }
  ];
  readonly vacancies = [
    { label: 'Police Constable UB / AB', value: '1,052 / 663' },
    { label: 'Forest Guard', value: '504' },
    { label: 'AFPF Constable', value: '405' },
    { label: 'Forester Grade-I', value: '211' },
    { label: 'Fireman', value: '337' }
  ];

  get startLink() { return this.auth.userSignal() ? '/dashboard' : '/login'; }

  ngOnInit() { this.pricing.load(); }

  scrollToPricing() {
    document.getElementById('police-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
