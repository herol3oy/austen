import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { SupabaseAuthService } from '../../services/auth.service';
import { LoadingStateService } from '../../services/loadingState.service';

@Component({
  selector: 'austen-login-page',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button mat-raised-button class="login-button" (click)="signIn()">
      <mat-icon>code</mat-icon>
      Continue with GitHub
    </button>
  `,
  styles: `
    .login-button {
      display: flex;
      margin: 2rem auto;
    }
  `,
})
export default class LoginPage {
  constructor(
    private readonly authService: SupabaseAuthService,
    private readonly loadingStateService: LoadingStateService,
    private readonly snackBar: MatSnackBar,
  ) {}

  signIn() {
    this.authService
      .signIn()
      .pipe(this.loadingStateService.spinUntilFinished())
      .subscribe({
        error: () => {
          this.snackBar.open('Error signing in', 'Close', {
            duration: 3000,
          });
        },
      });
  }
}
