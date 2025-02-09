import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, tap } from 'rxjs';

import { HeaderComponent } from './components/header/header.component';
import { SupabaseAuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, MatButtonModule],
  template: `
    <austen-header></austen-header>
    <router-outlet />
  `,
})
export class AppComponent {
  authService = inject(SupabaseAuthService);
  router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        tap(() => this.authService.refresh()),
      )
      .subscribe();
  }

  logout() {
    this.authService.logout();
  }
}
