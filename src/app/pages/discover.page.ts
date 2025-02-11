import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { from, of } from 'rxjs';
import { map, mergeMap, reduce, switchMap } from 'rxjs/operators';

import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { MermaidRenderService } from '../services/mermaid-render.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';
import { StoredGraph } from '../types/stored-graph';

@Component({
  selector: 'discover-page',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [SupabaseService, MermaidService, MermaidRenderService],
  template: `
    <div class="discover-container">
      <h2>Discover Public Graphs</h2>
      @if (graphs.length) {
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
                >
                  <mat-icon>visibility</mat-icon>
                  View
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      } @else if (error) {
        <div class="error-container">
          <p>{{ error }}</p>
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
    .discover-container {
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
export default class DiscoverPage implements OnInit {
  error: string | null = null;
  graphs: BookGraph[] = [];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mermaidService: MermaidService,
    private readonly mermaidRenderService: MermaidRenderService,
    private readonly router: Router,
    private readonly loadingStateService: LoadingStateService,
  ) {}

  ngOnInit() {
    this.mermaidService.initializeMermaid();
    this.loadPublicGraphs();
  }

  viewGraph(id: string) {
    this.router.navigate(['/share', id]);
  }

  private loadPublicGraphs() {
    const renderGraph$ = (graph: StoredGraph) =>
      this.mermaidRenderService.renderMermaid(graph.mermaid_syntax).pipe(
        this.loadingStateService.spinUntilFinished(),

        map((svgGraph) => ({
          id: graph.id,
          bookName: graph.book_name,
          authorName: graph.author_name,
          svgGraph,
          mermaidSyntax: graph.mermaid_syntax,
          emojis: graph.emojis,
        })),
      );

    this.supabaseService
      .getPublicGraphs()
      .pipe(
        this.loadingStateService.spinUntilFinished(),
        switchMap((graphs) =>
          graphs.length
            ? from(graphs).pipe(
                this.loadingStateService.spinUntilFinished(),

                mergeMap(renderGraph$),
                reduce<BookGraph, BookGraph[]>(
                  (acc, curr) => [...acc, curr],
                  [],
                ),
              )
            : of([]),
        ),
      )
      .subscribe({
        next: (graphs) => {
          this.graphs = graphs;
        },
        error: (error) => {
          this.error =
            error.message || 'An error occurred while loading the graphs.';
        },
      });
  }
}
