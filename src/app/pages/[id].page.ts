import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';

import { GraphCardComponent } from '../components/graph-card.component';
import { SupabaseAuthService } from '../services/auth.service';
import { ClipboardService } from '../services/clipboard.service';
import { DownloadService } from '../services/download.service';
import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';

@Component({
  providers: [
    SupabaseService,
    ClipboardService,
    MermaidService,
    SupabaseAuthService,
    DownloadService,
  ],
  imports: [
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatMenuModule,
    GraphCardComponent,
  ],
  template: `
    <div class="share-container">
      @if (error) {
        <div class="error-container">
          <p>{{ error }}</p>
        </div>
      } @else if (graph) {
        <div class="graph-details">
          <austen-graph-card
            [graph]="graph"
            [showView]="false"
            [showDownload]="true"
            [showCopyUrl]="true"
            [showCopySyntax]="true"
            [alwaysShowSyntax]="true"
            [showEditSyntax]="isGraphOwner"
            (downloadSvg)="downloadSvg()"
            (downloadPng)="downloadPng()"
            (copyUrl)="copyUrl(graph.id)"
            (copySyntax)="copyMermaidSyntax()"
            (syntaxChange)="onSyntaxChange($event)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .share-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .graph-details {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .error-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }
  `,
})
export default class SharePage implements OnInit {
  error: string | null = null;
  graph: BookGraph | null = null;
  isMermaidSyntaxVisible = false;
  isGraphOwner = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mermaidService: MermaidService,
    private readonly supabaseService: SupabaseService,
    private readonly clipboardService: ClipboardService,
    private readonly snackBar: MatSnackBar,
    private readonly authService: SupabaseAuthService,
    private readonly downloadService: DownloadService,
    private readonly loadingStateService: LoadingStateService,
  ) {}

  private readonly pageId = this.route.paramMap.pipe(
    map((params) => params.get('id')),
  );

  ngOnInit() {
    this.mermaidService.initializeMermaid();

    this.pageId.subscribe({
      next: (id) => {
        if (id) {
          this.loadGraph(id);
        }
      },
    });
  }

  toggleMermaidSyntax() {
    this.isMermaidSyntaxVisible = !this.isMermaidSyntaxVisible;
  }

  copyMermaidSyntax() {
    if (this.graph?.mermaidSyntax) {
      this.clipboardService
        .copyToClipboard(this.graph.mermaidSyntax)
        .subscribe({
          next: () => {
            this.snackBar.open('Syntax copied!', 'Close', {
              duration: 1500,
            });
          },
          error: () => {
            this.snackBar.open('Failed to copy syntax', 'Close', {
              duration: 1500,
            });
          },
        });
    }
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

  onSyntaxChange(newSyntax: string) {
    if (this.graph && this.isGraphOwner) {
      this.supabaseService
        .updateGraph(this.graph.id, { mermaid_syntax: newSyntax })
        .subscribe({
          next: () => {
            this.snackBar.open('Graph updated successfully', 'Close', {
              duration: 3000,
            });
          },
          error: () => {
            this.snackBar.open('Failed to update graph', 'Close', {
              duration: 3000,
            });
          },
        });
    }
  }

  downloadSvg(): void {
    if (!this.graph) return;

    if (!this.authService.loggedIn()) {
      this.snackBar.open('Please login to download SVG file', 'Login', {
        duration: 3000,
      });
      return;
    }

    const svgElement = document.querySelector('svg');
    if (svgElement) {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const fileName = `${this.graph.bookName}-svg-graph`;
      this.downloadService
        .createSvg(svgString, fileName)
        .pipe(this.loadingStateService.spinUntilFinished())
        .subscribe({
          next: () => {
            this.snackBar.open('SVG downloaded!', 'Close', {
              duration: 3000,
            });
          },
          error: () => {
            this.snackBar.open('Failed to download SVG', 'Close', {
              duration: 3000,
            });
          },
        });
    }
  }

  downloadPng(): void {
    if (!this.graph) return;

    const svgElement = document.querySelector('svg');
    if (svgElement) {
      const fileName = `${this.graph.bookName}-png-graph`;
      this.downloadService
        .createPng(svgElement, fileName)
        .pipe(this.loadingStateService.spinUntilFinished())
        .subscribe({
          next: () => {
            this.snackBar.open('PNG downloaded!', 'Close', {
              duration: 3000,
            });
          },
          error: () => {
            this.snackBar.open('Failed to download PNG', 'Close', {
              duration: 3000,
            });
          },
        });
    }
  }

  private loadGraph(id: string) {
    this.supabaseService
      .getGraphById(id)
      .pipe(
        this.loadingStateService.spinUntilFinished(),
        switchMap((data) => {
          if (!data) throw new Error('Graph not found');
          return this.mermaidService.renderMermaid(data.mermaid_syntax).pipe(
            this.loadingStateService.spinUntilFinished(),
            map((svgGraph) => ({
              id: data.id,
              bookName: data.book_name,
              authorName: data.author_name,
              svgGraph,
              mermaidSyntax: data.mermaid_syntax,
              emojis: data.emojis,
            })),
          );
        }),
      )
      .subscribe({
        next: (graph) => {
          this.graph = graph;
          this.checkGraphOwnership();
        },
        error: () => {
          this.error = 'An error occurred while loading the graph.';
        },
      });
  }

  private checkGraphOwnership() {
    if (!this.graph) return;

    this.authService.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.supabaseService
          .getGraphById(this.graph!.id)
        .pipe(this.loadingStateService.spinUntilFinished())

          .subscribe((graphData) => {
            this.isGraphOwner = graphData?.user_id === session.user.id;
          });
      } else {
        this.isGraphOwner = false;
      }
    });
  }
}
