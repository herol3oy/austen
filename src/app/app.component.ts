import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subject, takeUntil, tap } from 'rxjs';

import { HeaderComponent } from './components/header.component';
import { SupabaseAuthService } from './services/auth.service';
import { LoadingStateService } from './services/loadingState.service';

@Component({
  selector: 'austen-root',
  providers: [LoadingStateService],
  imports: [RouterOutlet, HeaderComponent, MatButtonModule],
  template: `
    <austen-header></austen-header>
    <router-outlet />
    @if (isSpinnerOn) {
      <div class="overlay">
        <div class="pulsing-background">
          <img
            class="austen-logo pulse-animation"
            src="/jane-austen-inspired-illustrations.png"
            alt="Jane Austen is thinking..."
          />
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(6px);
    }

    .pulsing-background {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
      animation: pulseBackground 2.5s infinite ease-in-out;
    }

    .austen-logo {
      width: 160px;
      height: auto;
      filter: drop-shadow(0px 4px 8px rgba(255, 255, 255, 0.2));
    }

    .pulse-animation {
      animation: pulse 2.5s infinite ease-in-out;
    }

    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.85;
      }
    }

    @keyframes pulseBackground {
      0% {
        transform: scale(1);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
      }
      50% {
        transform: scale(1.15);
        box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
      }
    }
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  isSpinnerOn = false;

  private readonly componentDestroyed: Subject<void> = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly authService: SupabaseAuthService,
    private readonly loadingStateService: LoadingStateService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        tap(() => this.authService.refresh()),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.startWatchingSpinnerChanges();
  }

  ngOnDestroy(): void {
    this.componentDestroyed.next();
    this.componentDestroyed.complete();
  }

  private startWatchingSpinnerChanges(): void {
    this.loadingStateService
      .isSpinnerVisible()
      .pipe(
        tap((): void => this.changeDetector.detectChanges()),
        takeUntil(this.componentDestroyed),
      )
      .subscribe({
        next: (isSpinnerOn: boolean): void => {
          this.isSpinnerOn = isSpinnerOn;
          this.changeDetector.detectChanges();
        },
        error: (): boolean => (this.isSpinnerOn = false),
      });
  }

  logout() {
    this.authService.logout();
  }
}
