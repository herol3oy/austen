import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subject, takeUntil, tap } from 'rxjs';

import { TopbarComponent } from './components/topbar.component';
import { SupabaseAuthService } from './services/auth.service';
import { LoadingStateService } from './services/loadingState.service';

@Component({
  selector: 'austen-root',
  providers: [LoadingStateService],
  imports: [RouterOutlet, TopbarComponent],
  template: `
    <austen-topbar></austen-topbar>
    <router-outlet />
    @if (isSpinnerOn) {
      <div class="overlay-container">
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
    .overlay-container {
      position: fixed;
      inset: 0;
      background-color: rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(10px);
    }

    .pulsing-background {
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: pulse 3s infinite ease-in-out;
    }

    .austen-logo {
      width: 9rem;
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 0.7;
      }
      50% {
        transform: scale(1.15);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 0.7;
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
