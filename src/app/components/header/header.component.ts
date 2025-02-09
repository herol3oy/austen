import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, tap } from 'rxjs';

import { SupabaseAuthService } from '../../services/auth.service';

@Component({
  selector: 'austen-header',
  standalone: true,
  imports: [RouterModule, MatIconModule, MatButtonModule],
  styleUrl: './header.component.scss',
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  constructor(
    readonly authService: SupabaseAuthService,
    private readonly router: Router,
  ) {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        tap(() => this.authService.refresh()),
      )
      .subscribe();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
