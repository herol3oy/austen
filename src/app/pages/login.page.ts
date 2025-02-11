import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';

import { SupabaseAuthService } from '../services/auth.service';
import { LoadingStateService } from '../services/loadingState.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
    RouterModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Welcome Back</mat-card-title>
          <mat-card-subtitle>Sign in to your account</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form
            [formGroup]="loginForm"
            (ngSubmit)="onSubmit()"
            class="login-form"
          >
            @if (error) {
              <div class="error-message">
                {{ error }}
              </div>
            }

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                required
                placeholder="Enter your email"
                autocomplete="email"
              />
              <mat-icon matSuffix>email</mat-icon>
              @if (
                loginForm.get('email')?.errors?.['required'] &&
                loginForm.get('email')?.touched
              ) {
                <mat-error>Email is required</mat-error>
              }
              @if (loginForm.get('email')?.errors?.['email']) {
                <mat-error>Please enter a valid email</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="password"
                required
                placeholder="Enter your password"
                autocomplete="current-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
              >
                <mat-icon>{{
                  hidePassword ? 'visibility_off' : 'visibility'
                }}</mat-icon>
              </button>
              @if (
                loginForm.get('password')?.errors?.['required'] &&
                loginForm.get('password')?.touched
              ) {
                <mat-error>Password is required</mat-error>
              }
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="login-button"
              [disabled]="loginForm.invalid"
            >
              Sign in
            </button>
          </form>
        </mat-card-content>

        <mat-card-footer>
          <p class="signup-link">
            Don't have an account?
            <a routerLink="/signup" mat-button color="primary"
              >Create one here</a
            >
          </p>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: `
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 64px);
      padding: 2rem;
      background-color: #f5f5f5;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 2rem;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }

    .login-button {
      margin-top: 1rem;
      height: 48px;
      font-size: 16px;
    }

    mat-card-header {
      margin-bottom: 1rem;
    }

    mat-card-title {
      font-size: 24px;
      margin-bottom: 0.5rem;
    }

    mat-card-subtitle {
      font-size: 16px;
      opacity: 0.8;
    }

    .signup-link {
      text-align: center;
      margin: 1rem 0;
      font-size: 14px;
    }

    mat-form-field {
      width: 100%;
    }

    .error-message {
      background-color: #ffebee;
      color: #c62828;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 14px;
    }

    .info-text {
      text-align: center;
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
      margin: 1rem 0 0;
    }
  `,
})
export default class LoginPage {
  error: string | null = null;
  hidePassword = true;

  constructor(
    private readonly authService: SupabaseAuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly loadingStateService: LoadingStateService,
  ) {}

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.error = null;

    const { email, password } = this.loginForm.value;

    this.authService
      .signIn(email, password)
      .pipe(this.loadingStateService.spinUntilFinished())
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: () => {
          this.error = 'An error occurred during login. Please try again.';
        },
      });
  }
}
