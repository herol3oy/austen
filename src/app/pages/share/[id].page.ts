import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap } from 'rxjs/operators';
import { BookGraph } from 'src/app/types/book-graph';

import { SupabaseAuthService } from '../../services/auth.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DownloadService } from '../../services/download.service';
import { MermaidService } from '../../services/mermaid.service';
import { MermaidRenderService } from '../../services/mermaid-render.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  providers: [
    SupabaseService,
    ClipboardService,
    MermaidService,
    SupabaseAuthService,
    DownloadService,
    MermaidRenderService,
  ],
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatMenuModule,
  ],
  templateUrl: './share.page.html',
  styleUrl: './share.page.scss',
})
export default class SharePage implements OnInit {
  loading = true;
  error: string | null = null;
  graph: BookGraph | null = null;
  isMermaidSyntaxVisible = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mermaidService: MermaidService,
    private readonly supabaseService: SupabaseService,
    private readonly clipboardService: ClipboardService,
    private readonly snackBar: MatSnackBar,
    private readonly authService: SupabaseAuthService,
    private readonly downloadService: DownloadService,
    private readonly mermaidRenderService: MermaidRenderService,
  ) {}

  ngOnInit() {
    this.mermaidService.initializeMermaid();

    const id = this.route.snapshot.params['id'];
    this.loadGraph(id);
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

  copyUrl() {
    const url = window.location.href;
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
      this.downloadService.createSvg(svgString, fileName).subscribe({
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
      this.downloadService.createPng(svgElement, fileName).subscribe({
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
        switchMap((data) => {
          if (!data) throw new Error('Graph not found');
          return this.mermaidRenderService
            .renderMermaid(data.mermaid_syntax)
            .pipe(
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
          this.loading = false;
          this.graph = graph;
        },
        error: () => {
          this.loading = false;
          this.error = 'An error occurred while loading the graph.';
        },
      });
  }
}
