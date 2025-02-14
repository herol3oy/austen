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
  selector: 'austen-topbar',
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatToolbarModule,
  ],
  template: `
    <mat-toolbar class="topbar-container">
      <nav class="nav-links left-nav desktop-menu">
        <a
          mat-flat-button
          color="primary"
          routerLink="/discover"
          routerLinkActive="active"
          class="discover-btn"
        >
          <mat-icon>explore</mat-icon>
          <span>Discover</span>
        </a>
      </nav>

      <div class="logo-section">
        <a routerLink="/">
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

      <nav class="nav-links right-nav desktop-menu">
        <a mat-button href="https://github.com/herol3oy/austen" target="_blank">
          <mat-icon>code</mat-icon>
          <span>Github</span>
        </a>
        @if (authService.loggedIn()) {
          <a mat-button routerLink="/my-graphs" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>My Graphs</span>
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
          routerLink="/discover"
          routerLinkActive="active"
          class="discover-menu-item"
        >
          <mat-icon>explore</mat-icon>
          <span>Discover</span>
        </a>
        <a
          mat-menu-item
          href="https://github.com/herol3oy/austen"
          target="_blank"
        >
          <mat-icon>code</mat-icon>
          <span>Github</span>
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
    .topbar-container {
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 4rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
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

    .discover-btn {
      font-weight: 500;
      font-size: 1rem;
      letter-spacing: 0.5px;
      padding: 0.5rem 1.25rem;
      transition: all 0.2s ease;
      background-color: #1976d2;
      color: white;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
        background-color: #1565c0;
      }

      &.active {
        background-color: #0d47a1;
        color: white;
      }

      mat-icon {
        margin-right: 0.5rem;
        font-size: 1.2rem;
        width: 1.2rem;
        height: 1.2rem;
      }
    }

    .discover-menu-item {
      color: #1976d2;
      font-weight: 500;

      &.active {
        background-color: rgba(25, 118, 210, 0.1);
      }
    }

    .left-nav {
      margin-right: auto;
    }

    .right-nav {
      margin-left: auto;
    }

    .mobile-menu-button {
      display: none;
    }

    @media (max-width: 768px) {
      .desktop-menu {
        display: none;
      }

      .left-nav.desktop-menu {
        display: flex;
        position: absolute;
        left: 1rem;

        .discover-btn {
          padding: 0.4rem 1rem;
          font-size: 0.9rem;

          mat-icon {
            margin-right: 0.25rem;
            font-size: 1rem;
            width: 1rem;
            height: 1rem;
          }
        }
      }

      .mobile-menu-button {
        display: block;
        position: absolute;
        right: 1rem;
      }

      .logo-section {
        position: static;
        transform: none;
        margin: 0 auto;
      }

      .discover-menu-item {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .topbar-container {
        padding: 2.7rem 1rem;
      }

      .austen-logo {
        width: 3.5rem;
      }

      .austen-title {
        display: none;
      }

      .austen-subtitle {
        display: none;
      }

      .left-nav.desktop-menu .discover-btn {
        padding: 0.35rem 0.8rem;

        span {
          display: none;
        }

        mat-icon {
          margin: 0;
        }
      }
    }
  `,
})
export class TopbarComponent {
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
