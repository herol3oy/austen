import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { from, of } from 'rxjs';
import { map, mergeMap, reduce, switchMap } from 'rxjs/operators';

import { GraphCardComponent } from '../components/graph-card.component';
import { ClipboardService } from '../services/clipboard.service';
import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';
import { StoredGraph } from '../types/stored-graph';

@Component({
  selector: 'discover-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    GraphCardComponent,
  ],
  providers: [SupabaseService, MermaidService, ClipboardService],
  template: `
    <div class="discover-container">
      <h2>Discover Public Graphs</h2>
      @if (graphs.length) {
        <div class="graphs-grid">
          @for (graph of graphs; track graph.id) {
            <austen-graph-card
              [graph]="graph"
              (view)="viewGraph(graph.id)"
              [showCopyUrl]="true"
              (copyUrl)="copyUrl(graph.id)"
              [showEditSyntax]="false"
            />
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

    .error-container,
    .no-graphs-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      text-align: center;
      gap: 1rem;
    }

    .explore-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 1rem;
    }
  `,
})
export default class DiscoverPage implements OnInit {
  error: string | null = null;
  graphs: BookGraph[] = [];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mermaidService: MermaidService,
    private readonly router: Router,
    private readonly loadingStateService: LoadingStateService,
    private readonly clipboardService: ClipboardService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.mermaidService.initializeMermaid();
    this.loadPublicGraphs();
  }

  viewGraph(id: string) {
    this.router.navigate(['/', id]);
  }

  copyUrl(id: string) {
    const url = `${window.location.origin}/${id}`;
    this.clipboardService.copyToClipboard(url).subscribe({
      next: () => {
        this.snackBar.open('URL copied!', 'Close', {
          duration: 1500,
        });
      },
      error: () => {
        this.snackBar.open('Failed to copy URL', 'Close', {
          duration: 1500,
        });
      },
    });
  }

  private loadPublicGraphs() {
    const renderGraph$ = (graph: StoredGraph) =>
      this.mermaidService.renderMermaid(graph.mermaid_syntax).pipe(
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
