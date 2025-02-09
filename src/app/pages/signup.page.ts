import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';

import { SupabaseAuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup-page',
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
    <div class="signup-container">
      <mat-card class="signup-card">
        @if (loading) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }

        <mat-card-header>
          <mat-card-title>Create Account</mat-card-title>
          <mat-card-subtitle
            >Join to save and share your graphs</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          <form
            [formGroup]="signupForm"
            (ngSubmit)="onSubmit()"
            class="signup-form"
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
                autocomplete="off"
              />
              <mat-icon matSuffix>email</mat-icon>
              @if (
                signupForm.get('email')?.errors?.['required'] &&
                signupForm.get('email')?.touched
              ) {
                <mat-error>Email is required</mat-error>
              }
              @if (signupForm.get('email')?.errors?.['email']) {
                <mat-error>Please enter a valid email</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                required
                placeholder="Enter your password"
                autocomplete="off"
                minlength="6"
              />
              <mat-icon matSuffix>lock</mat-icon>
              <mat-hint>Password must be at least 6 characters long</mat-hint>
              @if (
                signupForm.get('password')?.errors?.['required'] &&
                signupForm.get('password')?.touched
              ) {
                <mat-error>Password is required</mat-error>
              }
              @if (signupForm.get('password')?.errors?.['minlength']) {
                <mat-error
                  >Password must be at least 6 characters long</mat-error
                >
              }
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="signup-button"
              [disabled]="signupForm.invalid || loading"
            >
              {{ loading ? 'Signing up...' : 'Sign Up' }}
            </button>
          </form>
        </mat-card-content>

        <mat-card-footer>
          <p class="login-link">
            Already have an account?
            <a routerLink="/login" mat-button color="primary">Login here</a>
          </p>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: `
    .signup-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 64px);
      padding: 2rem;
      background-color: #f5f5f5;
    }

    .signup-card {
      width: 100%;
      max-width: 400px;
      padding: 2rem;
    }

    .signup-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1rem;
    }

    .signup-button {
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

    .login-link {
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
  `,
})
export default class SignupPage {
  private authService = inject(SupabaseAuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loading = false;
  error: string | null = null;

  signupForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit() {
    if (this.signupForm.invalid) return;

    this.loading = true;
    this.error = null;

    const { email, password } = this.signupForm.value;

    this.authService.signUp(email, password).subscribe({
      next: ({ error }) => {
        this.loading = false;
        if (error) {
          this.error = error.message;
        } else {
          this.snackBar.open(
            'Please check your email to verify your account',
            'Close',
            { duration: 5000 },
          );
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'An error occurred during signup. Please try again.';
        console.error('Signup error:', err);
      },
    });
  }
}
