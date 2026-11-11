import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { PricingService } from '../../core/pricing.service';
import { CATEGORY_META } from '../../shared/category-meta';
import { packageImageFor } from '../../shared/package-images';
import { LANGUAGE_NOTE, NO_SUBSCRIPTION_NOTE, PYQ_PITCH } from '../../shared/pricing';

// Placeholder business details: replace with real ones before launch.
export const CONTACT = {
  email: 'support@letscrackadre.com',
  phone: '+91 70029 21105',
  address: 'Guwahati, Assam, India',
  hours: 'Mon - Sat, 9:00 AM - 6:00 PM IST'
};

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  readonly pricing = inject(PricingService);
  readonly packageImageFor = packageImageFor;

  ngOnInit() {
    this.pricing.load();
  }
  readonly contact = CONTACT;
  readonly year = new Date().getFullYear();
  readonly categories = Object.entries(CATEGORY_META).map(([name, meta]) => ({ name, ...meta }));
  menuOpen = false;

  get startLink(): string {
    return this.auth.userSignal() ? '/dashboard' : '/login';
  }

  get startLabel(): string {
    return this.auth.userSignal() ? 'Go to dashboard' : 'Start practising free';
  }

  readonly features = [
    { icon: '🗂️', title: '2,000+ questions, category-wise', text: 'Polity, History, Geography, Economy, Social Studies, English, Maths, Reasoning and dedicated Assam sections. Mix categories in a single test.' },
    { icon: '⏱️', title: 'Timed practice', text: 'One minute per question, tracked on the server. Pause any time and resume exactly where you stopped.' },
    { icon: '📊', title: 'Smart analytics', text: 'Pie and bar charts show accuracy by category, so you know exactly what to revise.' },
    { icon: '✅', title: 'Review at the end', text: 'No spoilers during the test. See correct answers and explanations only after you submit.' }
  ];

  readonly steps = [
    { n: 1, title: 'Register with email', text: 'Create your account with your email and a password, then log in anytime.' },
    { n: 2, title: 'Pick categories', text: 'Choose one or many categories and 10, 20 or 50 questions.' },
    { n: 3, title: 'Practise and review', text: 'Answer against the clock, then study the explanations and charts.' }
  ];

  get adrePlans() { return this.pricing.plansFor('adre'); }
  get planGroups() { return [
    { id: 'adre', label: 'THE ADRE COLLECTION', name: 'ADRE 3.0 Test Series', link: '/adre', plans: this.pricing.plansFor('adre') },
    { id: 'police-forest', label: 'THE POLICE & FOREST COLLECTION', name: 'Assam Police and Forest', link: '/assam-police-forest', plans: this.pricing.plansFor('police-forest') }
  ].filter((group) => group.plans.length); }
  readonly pricingNote = NO_SUBSCRIPTION_NOTE;
  readonly languageNote = LANGUAGE_NOTE;

  readonly pyq = PYQ_PITCH;
  readonly pyqYears = ['ADRE 1.0 (2022)', 'ADRE 2.0 (2024)'];
  readonly pyqPapers = ['Grade-III · Paper-III (HSSLC)', 'Grade-III · Paper-IV (Degree)', 'Grade-III · Paper-V (Driver)', 'Grade-IV · Paper-I (HSLC)', 'Grade-IV · Paper-II (Class VIII)'];

  readonly adreHighlights = [
    '10 Previous Year (PYQ) papers: ADRE 1.0 (2022) and ADRE 2.0 (2024), all five papers each',
    '2,000+ section-wise and category-wise practice questions',
    'Grade-III and Grade-IV: all five papers, with expected syllabus and marks distribution',
    'Negative marking, timing and subject-wise topics explained',
    'Timed sessions with pause and resume',
    'One-time purchase. No subscription.'
  ];

  scrollTo(id: string) {
    this.menuOpen = false;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  contactStatus: 'idle' | 'sending' | 'sent' | 'error' = 'idle';
  contactError = '';

  async sendMessage(event: Event, form: HTMLFormElement, name: string, email: string, message: string) {
    event.preventDefault();
    this.contactStatus = 'sending';
    this.contactError = '';
    try {
      await firstValueFrom(this.http.post(`${this.auth.apiBase}/contact`, { name, email, message }));
      this.contactStatus = 'sent';
      form.reset();
    } catch (e) {
      this.contactStatus = 'error';
      this.contactError = e instanceof HttpErrorResponse && e.error?.message ? e.error.message : 'Could not send your message. Please try again.';
    }
  }
}
