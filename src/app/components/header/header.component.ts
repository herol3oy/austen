import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  template: `
    <header class="austen-header">
      <div class="logo-section">
        <a routerLink="/">
          <img
            class="austen-logo"
            src="/jane-austen-inspired-illustrations.png"
            alt="Jane Austen"
          />
        </a>
        <div class="title-section">
          <h1>Austen</h1>
          <p class="subtitle">discover story relationships</p>
        </div>
      </div>
      <nav class="nav-links">
        <a routerLink="/">
          <mat-icon>home</mat-icon>
          Home
        </a>
        <a routerLink="/discover">
          <mat-icon>grid_view</mat-icon>
          Discover
        </a>
        <a routerLink="/about">
          <mat-icon>info</mat-icon>
          About
        </a>
        <a
          href="https://github.com/herol3oy/austen"
          target="_blank"
          rel="noopener noreferrer"
        >
          <mat-icon>code</mat-icon>
          GitHub
        </a>
      </nav>
    </header>
  `,
  styles: [
    `
      .austen-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 2rem;
        margin-bottom: 2rem;
        color: #2c3e50;
        background-color: #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }

      .logo-section {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .title-section {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .austen-logo {
        width: 3.5rem;
        height: 3.5rem;
        object-fit: cover;
        transition: transform 0.3s ease;
        cursor: pointer;

        &:hover {
          transform: scale(1.05);
        }
      }

      h1 {
        font-size: 1.8rem;
        margin: 0;
        font-weight: 300;
      }

      .subtitle {
        font-size: 0.9rem;
        color: #7f8c8d;
        margin: 0;
      }

      .nav-links {
        display: flex;
        gap: 1.5rem;

        a {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #2c3e50;
          text-decoration: none;
          font-size: 0.9rem;
          transition: color 0.3s ease;

          mat-icon {
            font-size: 1.2rem;
            height: 1.2rem;
            width: 1.2rem;
          }

          &:hover {
            color: #3498db;
          }
        }
      }

      @media (max-width: 600px) {
        .austen-header {
          flex-direction: column;
          padding: 1rem;
          gap: 1rem;
        }

        .logo-section {
          flex-direction: column;
          text-align: center;
        }

        .title-section {
          align-items: center;
        }

        h1 {
          font-size: 1.5rem;
        }

        .subtitle {
          font-size: 0.8rem;
        }

        .nav-links {
          gap: 1rem;
        }
      }
    `,
  ],
})
export class HeaderComponent {}
