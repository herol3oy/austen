import { RouteMeta } from '@analogjs/router';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import mermaid from 'mermaid';
import { finalize, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { SupabaseAuthService } from '../services/auth.service';
import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';
import { StoredGraph } from '../types/stored-graph';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title>Delete Graph</h2>
    <mat-dialog-content>
      Are you sure you want to delete this graph? This action cannot be undone.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
})
export class ConfirmDialogComponent {}

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
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDialogModule,
    RouterModule,
  ],
  providers: [SupabaseService, MermaidService],
  template: `
    <div class="dashboard-container">
      <h2>My Graphs</h2>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading your graphs...</p>
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
                <div class="action-buttons">
                  <button
                    mat-button
                    color="primary"
                    (click)="viewGraph(graph.id)"
                    [disabled]="actionLoading"
                  >
                    <mat-icon>visibility</mat-icon>
                    View
                  </button>
                  <button
                    mat-button
                    color="warn"
                    (click)="deleteGraph(graph.id)"
                    [disabled]="actionLoading"
                  >
                    <mat-icon>delete</mat-icon>
                    Delete
                  </button>
                </div>
                <mat-slide-toggle
                  [checked]="graphPublicStatus.get(graph.id) || false"
                  (change)="togglePublicStatus(graph.id, $event.checked)"
                  color="primary"
                  [disabled]="actionLoading"
                >
                  {{ graphPublicStatus.get(graph.id) ? 'Public' : 'Private' }}
                </mat-slide-toggle>
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
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
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
export default class DashboardPage implements OnInit {
  error: string | null = null;
  graphs: BookGraph[] = [];
  graphPublicStatus = new Map<string, boolean>();
  loading = false;
  actionLoading = false;
  actionLoadingId: string | null = null;

  private authService = inject(SupabaseAuthService);
  private supabaseService = inject(SupabaseService);
  private mermaidService = inject(MermaidService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  async ngOnInit() {
    await this.mermaidService.initializeMermaid();
    this.loadUserGraphs();
  }

  viewGraph(id: string) {
    this.router.navigate(['/share', id]);
  }

  deleteGraph(graphId: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.actionLoadingId = graphId;
        this.actionLoading = true;
        this.supabaseService.deleteGraph(graphId).subscribe({
          next: () => {
            this.graphs = this.graphs.filter((graph) => graph.id !== graphId);
            this.graphPublicStatus.delete(graphId);
            this.snackBar.open('Graph deleted successfully', 'Close', {
              duration: 3000,
            });
            this.actionLoadingId = null;
            this.actionLoading = false;
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error deleting graph:', error);
            this.snackBar.open(
              'Failed to delete graph. Please try again.',
              'Close',
              { duration: 3000 },
            );
            this.actionLoadingId = null;
            this.actionLoading = false;
            this.cdr.detectChanges();
          },
        });
      }
    });
  }

  togglePublicStatus(graphId: string, isPublic: boolean) {
    this.actionLoadingId = graphId;
    this.actionLoading = true;
    this.supabaseService.toggleGraphPublicStatus(graphId, isPublic).subscribe({
      next: (graph) => {
        this.graphPublicStatus.set(graphId, graph.is_public);
        this.snackBar.open(
          `Graph is now ${isPublic ? 'public' : 'private'}`,
          'Close',
          { duration: 3000 },
        );
        this.actionLoadingId = null;
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating graph status:', error);
        this.snackBar.open(
          'Failed to update graph status. Please try again.',
          'Close',
          { duration: 3000 },
        );
        this.graphPublicStatus.set(graphId, !isPublic);
        this.actionLoadingId = null;
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private async loadUserGraphs() {
    try {
      this.loading = true;
      const { data: session } = await this.authService.getSession();
      if (!session?.session?.user) {
        this.error = 'User not authenticated';
        this.loading = false;
        return;
      }

      this.supabaseService
        .getUserGraphs(session.session.user.id)
        .pipe(
          switchMap((graphs: StoredGraph[]) => {
            graphs.forEach((graph) => {
              this.graphPublicStatus.set(graph.id, graph.is_public);
            });

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
              err.message || 'An error occurred while loading your graphs.';
            this.cdr.detectChanges();
          },
        });
    } catch (error) {
      console.error('Error in loadUserGraphs:', error);
      this.error = 'An error occurred while loading your graphs.';
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
