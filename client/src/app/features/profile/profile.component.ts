import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService, UserSummary } from '../../core/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  user: UserSummary | null = this.auth.userSignal();
  stats = { attemptedCount: 0, testsCompleted: 0, averageAccuracy: 0 };
  accuracyByCategory: Array<{ category: string; accuracy: number; total: number }> = [];
  isDeleting = false;
  deletionError = '';
  readonly deletionForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(72)]],
    confirmation: [false, Validators.requiredTrue]
  });

  get initials(): string {
    const source = this.user?.name ?? this.user?.email ?? '';
    return source.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
  }

  async ngOnInit() {
    const api: string = environment.apiUrl;
    this.auth.loadProfile().then((profile) => (this.user = profile ?? this.user)).catch(() => undefined);
    try {
      const response = await firstValueFrom(this.http.get<{ data: any }>(`${api}/dashboard/stats`));
      const { attemptedCount, testsCompleted, averageAccuracy, categoryStats } = response.data;
      this.stats = { attemptedCount, testsCompleted, averageAccuracy };
      this.accuracyByCategory = [...categoryStats].sort((a: any, b: any) => b.accuracy - a.accuracy);
    } catch {
      // Stats are optional on the profile page.
    }
  }

  logout() {
    this.auth.logout();
  }

  async deleteAccount() {
    if (this.deletionForm.invalid) {
      this.deletionForm.markAllAsTouched();
      return;
    }

    this.isDeleting = true;
    this.deletionError = '';
    try {
      await this.auth.deleteMyAccount(this.deletionForm.controls.password.value);
    } catch (error) {
      this.deletionError = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : 'We could not delete your account. Please try again or email support@letscrackadre.com.';
    } finally {
      this.isDeleting = false;
    }
  }
}
