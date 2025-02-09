import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import mermaid from 'mermaid';
import { finalize, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';
import { StoredGraph } from '../types/stored-graph';

@Component({
  selector: 'app-explore-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [SupabaseService, MermaidService],
  template: `
    <div class="explore-container">
      <h2>Explore Public Graphs</h2>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Discovering public graphs...</p>
        </div>
      } @else if (error) {
        <div class="error-container">
          <p>{{ error }}</p>
        </div>
      } @else if (graphs.length) {
        <div class="graphs-grid">
          @for (graph of graphs; track graph.id) {
            <mat-card class="graph-card">
              <mat-card-header>
                <mat-card-title>{{ graph.bookName }}</mat-card-title>
                <mat-card-subtitle>{{ graph.authorName }}</mat-card-subtitle>
                <mat-card-subtitle>{{ graph.emojis }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div [innerHTML]="graph.svgGraph"></div>
              </mat-card-content>
              <mat-card-actions>
                <button
                  mat-button
                  color="primary"
                  (click)="viewGraph(graph.id)"
                  [disabled]="actionLoading"
                >
                  <mat-icon>visibility</mat-icon>
                  View
                </button>
              </mat-card-actions>
              @if (actionLoadingId === graph.id) {
                <div class="action-loading-overlay">
                  <mat-spinner diameter="30"></mat-spinner>
                </div>
              }
            </mat-card>
          }
        </div>
      } @else {
        <div class="no-graphs-container">
          <mat-icon class="explore-icon">explore</mat-icon>
          <p>No public graphs available yet. Be the first to share one!</p>
        </div>
      }
    </div>
  `,
  styles: `
    .explore-container {
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
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    .error-container,
    .no-graphs-container,
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      text-align: center;
      gap: 1rem;
    }

    .loading-container p {
      color: rgba(0, 0, 0, 0.6);
      font-size: 1.1rem;
      margin: 0;
    }

    .explore-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 1rem;
    }

    mat-card-actions {
      margin-top: auto;
      padding: 1rem;
    }

    .action-loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1;
    }
  `,
})
export default class ExplorePage implements OnInit {
  error: string | null = null;
  graphs: BookGraph[] = [];
  loading = false;
  actionLoading = false;
  actionLoadingId: string | null = null;

  private supabaseService = inject(SupabaseService);
  private mermaidService = inject(MermaidService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  async ngOnInit() {
    await this.mermaidService.initializeMermaid();
    this.loadPublicGraphs();
  }

  viewGraph(id: string) {
    this.actionLoadingId = id;
    this.actionLoading = true;
    this.router.navigate(['/share', id]);
  }

  private loadPublicGraphs() {
    try {
      this.loading = true;
      this.supabaseService
        .getPublicGraphs()
        .pipe(
          switchMap((graphs: StoredGraph[]) => {
            return from(
              Promise.all(
                graphs.map(async (graph) => {
                  try {
                    const { svg } = await mermaid.render(
                      'graph_' + Math.random().toString(36).substring(2, 15),
                      graph.mermaid_syntax,
                    );
                    return {
                      id: graph.id,
                      bookName: graph.book_name,
                      authorName: graph.author_name,
                      svgGraph: this.sanitizer.bypassSecurityTrustHtml(svg),
                      mermaidSyntax: graph.mermaid_syntax,
                      emojis: graph.emojis,
                    };
                  } catch (error) {
                    console.error('Error rendering graph:', error);
                    return null;
                  }
                }),
              ),
            );
          }),
          finalize(() => {
            this.loading = false;
            this.cdr.detectChanges();
          }),
        )
        .subscribe({
          next: (graphs) => {
            this.graphs = graphs.filter(
              (graph): graph is BookGraph => graph !== null,
            );
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error loading graphs:', err);
            this.error =
              err.message || 'An error occurred while loading the graphs.';
            this.loading = false;
            this.cdr.detectChanges();
          },
        });
    } catch (error) {
      console.error('Error in loadPublicGraphs:', error);
      this.error = 'An error occurred while loading the graphs.';
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
