import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, tap } from 'rxjs';

import { SupabaseAuthService } from '../services/auth.service';
import { LoadingStateService } from '../services/loadingState.service';

@Component({
  selector: 'austen-header',
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatToolbarModule,
  ],
  template: `
    <mat-toolbar class="header-container">
      <div class="logo-section">
        <a
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          <img
            class="austen-logo"
            src="/jane-austen-inspired-illustrations.png"
            alt="Jane Austen"
          />
        </a>
        <div class="title-section">
          <h1 class="austen-title">Austen</h1>
          <p class="austen-subtitle">discover story relationships</p>
        </div>
      </div>

      <span class="spacer"></span>

      <nav class="nav-links desktop-menu">
        <a
          mat-button
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          <mat-icon>home</mat-icon>
          <span>Home</span>
        </a>
        <a mat-button routerLink="/discover" routerLinkActive="active">
          <mat-icon>explore</mat-icon>
          <span>Discover</span>
        </a>
        @if (authService.loggedIn()) {
          <a mat-button routerLink="/my-graphs" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>My Graphs</span>
          </a>
          <a mat-button routerLink="/about" routerLinkActive="active">
            <mat-icon>info</mat-icon>
            <span>About</span>
          </a>
          <button mat-button (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Logout</span>
          </button>
        } @else {
          <a mat-button routerLink="/login" routerLinkActive="active">
            <mat-icon>login</mat-icon>
            <span>Login</span>
          </a>
        }
      </nav>

      <button
        mat-icon-button
        [matMenuTriggerFor]="mobileMenu"
        class="mobile-menu-button"
      >
        <mat-icon>menu</mat-icon>
      </button>
      <mat-menu #mobileMenu="matMenu">
        <a
          mat-menu-item
          routerLink="/"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          <mat-icon>home</mat-icon>
          <span>Home</span>
        </a>
        <a mat-menu-item routerLink="/discover" routerLinkActive="active">
          <mat-icon>explore</mat-icon>
          <span>Discover</span>
        </a>
        <a mat-menu-item routerLink="/about" routerLinkActive="active">
          <mat-icon>info</mat-icon>
          <span>About</span>
        </a>
        @if (authService.loggedIn()) {
          <a mat-menu-item routerLink="/my-graphs" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>My Graphs</span>
          </a>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Logout</span>
          </button>
        } @else {
          <a mat-menu-item routerLink="/login" routerLinkActive="active">
            <mat-icon>login</mat-icon>
            <span>Login</span>
          </a>
        }
      </mat-menu>
    </mat-toolbar>
  `,
  styles: `
    .header-container {
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 4rem 2rem;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .title-section {
      display: flex;
      flex-direction: column;
    }

    .austen-logo {
      width: 4.5rem;
      border-radius: 50%;
      transition: transform 0.2s ease;
      object-fit: cover;

      &:hover {
        transform: scale(1.05);
      }
    }

    .austen-title {
      font-size: 1.8rem;
      margin: 0;
      font-weight: 300;
    }

    .austen-subtitle {
      font-size: 0.9rem;
      color: #7f8c8d;
      margin: 0;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      mat-icon {
        margin-right: 0.25rem;
      }

      a {
        &.active {
          color: #1976d2;
          background: rgba(25, 118, 210, 0.1);
        }
      }
    }

    .mobile-menu-button {
      display: none;
    }

    @media (max-width: 768px) {
      .desktop-menu {
        display: none;
      }

      .mobile-menu-button {
        display: block;
      }
    }

    @media (max-width: 480px) {
      .austen-logo {
        width: 3.5rem;
      }
    }
  `,
})
export class HeaderComponent {
  constructor(
    readonly authService: SupabaseAuthService,
    private readonly router: Router,
    private readonly loadingStateService: LoadingStateService,
  ) {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        tap(() => this.authService.refresh()),
      )
      .subscribe();
  }

  logout() {
    this.authService
      .logout()
      .pipe(this.loadingStateService.spinUntilFinished())
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
      });
  }
}
