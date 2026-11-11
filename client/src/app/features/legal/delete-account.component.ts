import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

type DeletionStage = 'request' | 'verify' | 'complete';

@Component({
  selector: 'app-delete-account',
  templateUrl: './delete-account.component.html',
  styleUrls: ['./legal.component.css']
})
export class DeleteAccountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  stage: DeletionStage = 'request';
  isSubmitting = false;
  errorMessage = '';
  infoMessage = '';

  readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    confirmation: [false, Validators.requiredTrue]
  });

  readonly verifyForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  ngOnInit(): void {
    if (this.router.getCurrentNavigation()?.extras.state?.['deletionCompleted'] === true) {
      this.stage = 'complete';
    }
  }

  async requestCode(): Promise<void> {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.infoMessage = '';
    try {
      const { email } = this.requestForm.getRawValue();
      await this.auth.requestAccountDeletionCode(email.trim().toLowerCase());
      this.stage = 'verify';
      this.infoMessage = 'If an eligible account exists and email delivery is available, a verification code will be sent. Deletion is not complete until you enter it. If no code arrives, contact support.';
    } catch (error) {
      this.errorMessage = this.messageFor(error, 'We could not start the request. Please try again or email support@letscrackadre.com.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async verifyAndDelete(): Promise<void> {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.infoMessage = '';
    const email = this.requestForm.controls.email.value.trim().toLowerCase();
    try {
      await this.auth.confirmAccountDeletionCode(email, this.verifyForm.controls.code.value);
      if (this.auth.userSignal()?.email?.toLowerCase() === email) {
        this.auth.clearSession();
      }
      this.stage = 'complete';
    } catch (error) {
      this.errorMessage = this.messageFor(error, 'We could not verify the code. Request a new code or email support@letscrackadre.com.');
    } finally {
      this.isSubmitting = false;
    }
  }

  startOver(): void {
    this.stage = 'request';
    this.errorMessage = '';
    this.infoMessage = '';
    this.verifyForm.reset({ code: '' });
  }

  private messageFor(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return fallback;
  }
}
