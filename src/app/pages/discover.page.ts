import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import mermaid from 'mermaid';
import { HeaderComponent } from '../components/header/header.component';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';

import { DomSanitizer } from '@angular/platform-browser';
import { from, switchMap } from 'rxjs';

@Component({
  selector: 'app-graphs',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <app-header></app-header>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading graphs...</p>
        </div>
      } @else if (error) {
        <div class="error-container">
          <p>{{ error }}</p>
        </div>
      } @else if (graphs.length) {
        <div class="graphs-grid">
          @for (graph of graphs; track graph.id) {
            <mat-card class="graph-card" (click)="navigateToGraph(graph.id)">
              <mat-card-header>
                <mat-card-title>{{ graph.bookName }}</mat-card-title>
                <mat-card-subtitle>{{ graph.authorName }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="svg-preview" [innerHTML]="graph.svgGraph"></div>
              </mat-card-content>
              <mat-card-footer>
                <mat-card-actions>
                  <button
                    mat-icon-button
                    color="primary"
                    (click)="copyUrl(graph.id, $event)"
                    matTooltip="Copy url"
                  >
                    <mat-icon>link</mat-icon>
                  </button>
                </mat-card-actions>
              </mat-card-footer>
            </mat-card>
          }
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon>library_books</mat-icon>
          <p>No graphs found. Start by creating one!</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-container {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
      }

      .graphs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 2rem;
        padding: 1rem 0;
      }

      .graph-card {
        cursor: pointer;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
        }

        .svg-preview {
          max-height: 200px;
          overflow: hidden;
          margin: 1rem 0;
        }
      }

      .loading-container,
      .error-container,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        text-align: center;
        color: #7f8c8d;

        mat-icon {
          font-size: 3rem;
          height: 3rem;
          width: 3rem;
          margin-bottom: 1rem;
        }
      }

      mat-card-actions {
        display: flex;
        justify-content: flex-end;
        padding: 8px;
      }

      @media (max-width: 600px) {
        .page-container {
          padding: 1rem;
        }

        .graphs-grid {
          grid-template-columns: 1fr;
          gap: 1rem;
        }
      }
    `,
  ],
})
export default class GraphsPage implements OnInit {
  loading = true;
  error: string | null = null;
  graphs: BookGraph[] = [];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });

    this.loadGraphs();
  }

  navigateToGraph(id: string): void {
    this.router.navigate(['/share', id]);
  }

  copyUrl(id: string, event: MouseEvent): void {
    event.stopPropagation();
    const url = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('URL copied!', 'Close', {
        duration: 1500,
      });
    });
  }

  private loadGraphs(): void {
    this.supabaseService
      .getAllGraphs()
      .pipe(
        switchMap(({ data, error }) => {
          if (error) throw new Error('Failed to load graphs');
          if (!data) throw new Error('No graphs found');

          return from(
            Promise.all(
              data.map((graph: any) =>
                mermaid
                  .render(
                    'graph_' + Math.random().toString(36).substring(2, 15),
                    graph.mermaid_syntax,
                  )
                  .then(({ svg }) => ({
                    id: graph.id,
                    bookName: graph.book_name,
                    authorName: graph.author_name,
                    svgGraph: this.sanitizer.bypassSecurityTrustHtml(svg),
                    mermaidSyntax: graph.mermaid_syntax,
                  })),
              ),
            ),
          );
        }),
      )
      .subscribe({
        next: (graphs) => {
          this.loading = false;
          this.graphs = graphs;
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'An error occurred while loading graphs.';
        },
      });
  }
}
