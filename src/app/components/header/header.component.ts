import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, tap } from 'rxjs';

import { SupabaseAuthService } from '../../services/auth.service';
import { LoadingStateService } from '../../services/loadingState.service';

@Component({
  selector: 'austen-header',
  imports: [
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatToolbarModule,
  ],
  styleUrl: './header.component.scss',
  templateUrl: './header.component.html',
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
