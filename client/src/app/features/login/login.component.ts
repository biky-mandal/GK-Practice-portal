import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';

type Mode = 'login' | 'forgot' | 'reset';

const STRONG_PASSWORD = [Validators.required, Validators.minLength(4), Validators.maxLength(72)];

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(MatSnackBar);

  mode: Mode = 'login';
  showPassword = false;
  isSubmitting = false;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(72)]],
    otp: ['']
  });

  setMode(mode: Mode) {
    this.mode = mode;
    const { password, otp } = this.form.controls;
    otp.setValidators(mode === 'reset' ? [Validators.required, Validators.pattern(/^\d{6}$/)] : []);
    password.setValidators(mode === 'forgot' ? [] : STRONG_PASSWORD);
    password.reset('');
    otp.reset('');
    for (const control of [password, otp]) control.updateValueAndValidity();
    this.form.markAsUntouched();
    this.showPassword = false;
  }

  get title() {
    return { login: 'Welcome', forgot: 'Forgot password?', reset: 'Reset password' }[this.mode];
  }

  get subtitle() {
    return {
      login: 'Sign in to continue. New here? Your account is created automatically.',
      forgot: "Enter your email and we'll send you a 6-digit code.",
      reset: `Enter the code sent to ${this.form.controls.email.value} and choose a new password.`
    }[this.mode];
  }

  get buttonLabel() {
    if (this.isSubmitting) return 'Please wait...';
    return { login: 'Sign in', forgot: 'Send code', reset: 'Update password' }[this.mode];
  }

  async resendCode() {
    await this.run(async () => {
      await this.auth.forgotPassword(this.form.controls.email.value.trim());
      this.snack.open('A new code has been sent if the account exists.', 'Close', { duration: 4000 });
    }, 'Could not send the code.');
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, otp } = this.form.getRawValue();
    const address = email.trim();

    await this.run(async () => {
      if (this.mode === 'forgot') {
        await this.auth.forgotPassword(address);
        this.setMode('reset');
        this.form.controls.email.setValue(address);
        this.snack.open('If an account exists for that email, a code has been sent.', 'Close', { duration: 5000 });
        return;
      }
      if (this.mode === 'reset') {
        await this.auth.resetPassword(address, otp.trim(), password);
        this.setMode('login');
        this.form.controls.email.setValue(address);
        this.snack.open('Password updated. Please sign in.', 'Close', { duration: 5000 });
        return;
      }
      const user = await this.auth.login(address, password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.includes('\\')
        ? returnUrl : '/dashboard';
      this.router.navigateByUrl(user.role === 'user' ? destination : '/admin');
    }, this.mode === 'login' ? 'Could not sign in.' : 'Something went wrong. Please try again.');
  }

  private async run(action: () => Promise<void>, fallback: string) {
    this.isSubmitting = true;
    try {
      await action();
    } catch (error) {
      const message = error instanceof HttpErrorResponse ? error.error?.message : null;
      this.snack.open(message ?? fallback, 'Close', { duration: 4000 });
      this.form.controls.password.reset('');
    } finally {
      this.isSubmitting = false;
    }
  }
}
