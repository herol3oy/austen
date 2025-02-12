import { RouteMeta } from '@analogjs/router';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { from, map, mergeMap, of, reduce, switchMap, tap } from 'rxjs';

import { ConfirmDialogComponent } from '../components/confirm-dialog.component';
import { GraphCardComponent } from '../components/graph-card.component';
import { SupabaseAuthService } from '../services/auth.service';
import { ClipboardService } from '../services/clipboard.service';
import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';

export const routeMeta: RouteMeta = {
  canActivate: [
    async () => {
      const authService = inject(SupabaseAuthService);
      const router = inject(Router);
      const { data, error } = await authService.getSession();

      if (error || !data?.session) {
        router.navigate(['/login']);
        return false;
      }

      return true;
    },
  ],
};

@Component({
  selector: 'austen-dashboard-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    RouterModule,
    GraphCardComponent,
  ],
  providers: [SupabaseService, MermaidService, ClipboardService],
  template: `
    <div class="dashboard-container">
      <h2>My Graphs</h2>
      @if (graphs.length) {
        <div class="graphs-grid">
          @for (graph of graphs; track graph.id) {
            <austen-graph-card
              [graph]="graph"
              [showDelete]="true"
              [showPublicToggle]="true"
              [isPublic]="graphPublicStatus.get(graph.id) || false"
              (view)="viewGraph(graph.id)"
              (delete)="deleteGraph(graph)"
              (publicToggle)="togglePublicStatus(graph.id, $event)"
              [showCopyUrl]="true"
              (copyUrl)="copyUrl(graph.id)"
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
          <p>
            You haven't created any graphs yet. Go to the home page to create
            one!
          </p>
          <button mat-raised-button color="primary" routerLink="/">
            Create Graph
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .dashboard-container {
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
export default class DashboardPage implements OnInit {
  error: string | null = null;
  graphs: BookGraph[] = [];
  graphPublicStatus = new Map<string, boolean>();

  constructor(
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly authService: SupabaseAuthService,
    private readonly supabaseService: SupabaseService,
    private readonly mermaidService: MermaidService,
    private readonly loadingStateService: LoadingStateService,
    private readonly clipboardService: ClipboardService,
  ) {}

  ngOnInit() {
    this.mermaidService.initializeMermaid();
    this.loadUserGraphs();
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

  deleteGraph(graph: BookGraph) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          bookName: graph.bookName,
          authorName: graph.authorName,
        },
      })
      .afterClosed()
      .pipe(
        this.loadingStateService.spinUntilFinished(),
        switchMap((result) =>
          result
            ? this.supabaseService
                .deleteGraph(graph.id)
                .pipe(map(() => graph.id))
            : of(null),
        ),
      )
      .subscribe({
        next: (deletedGraphId) => {
          if (deletedGraphId) {
            this.graphs = this.graphs.filter(
              (graph) => graph.id !== deletedGraphId,
            );
            this.graphPublicStatus.delete(deletedGraphId);
            this.snackBar.open('Graph deleted successfully', 'Close', {
              duration: 3000,
            });
          }
        },
        error: () => {
          this.snackBar.open('An error occurred in the dialog.', 'Close', {
            duration: 3000,
          });
        },
      });
  }

  togglePublicStatus(graphId: string, isPublic: boolean) {
    this.supabaseService
      .toggleGraphPublicStatus(graphId, isPublic)
      .pipe(this.loadingStateService.spinUntilFinished())
      .subscribe({
        next: (graph) => {
          this.graphPublicStatus.set(graphId, graph.is_public);
          this.snackBar.open(
            `Graph is now ${isPublic ? 'public' : 'private'}`,
            'Close',
            { duration: 3000 },
          );
        },
        error: () => {
          this.snackBar.open(
            'Failed to update graph status. Please try again.',
            'Close',
            { duration: 3000 },
          );
          this.graphPublicStatus.set(graphId, !isPublic);
        },
      });
  }

  private loadUserGraphs() {
    from(this.authService.getSession())
      .pipe(
        this.loadingStateService.spinUntilFinished(),
        map(({ data: { session } }) => session!.user.id),
        switchMap((userId) =>
          this.supabaseService.getUserGraphs(userId).pipe(
            this.loadingStateService.spinUntilFinished(),
            tap((graphs) => {
              graphs.forEach((graph) => {
                this.graphPublicStatus.set(graph.id, graph.is_public);
              });
            }),
            switchMap((graphs) =>
              graphs.length
                ? from(graphs).pipe(
                    this.loadingStateService.spinUntilFinished(),
                    mergeMap((graph) =>
                      this.mermaidService
                        .renderMermaid(graph.mermaid_syntax)
                        .pipe(
                          this.loadingStateService.spinUntilFinished(),
                          map((svgGraph) => ({
                            id: graph.id,
                            bookName: graph.book_name,
                            authorName: graph.author_name,
                            svgGraph,
                            mermaidSyntax: graph.mermaid_syntax,
                            emojis: graph.emojis,
                          })),
                        ),
                    ),
                    reduce<BookGraph, BookGraph[]>(
                      (acc, curr) => [...acc, curr],
                      [],
                    ),
                  )
                : of([]),
            ),
          ),
        ),
      )
      .subscribe({
        next: (graphs) => {
          this.graphs = graphs;
        },
        error: (error) => {
          this.error =
            error.message || 'An error occurred while loading your graphs.';
        },
      });
  }
}
