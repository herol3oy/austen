import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { HeaderComponent } from '../../components/header/header.component';
import { SupabaseService } from '../../services/supabase.service';

import mermaid from 'mermaid';
import { BookGraph } from 'src/app/types/book-graph';

@Component({
  selector: 'app-share',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    HeaderComponent,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <app-header></app-header>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading shared graph...</p>
        </div>
      } @else if (error) {
        <div class="error-container">
          <p>{{ error }}</p>
        </div>
      } @else if (graph) {
        <mat-card class="graph-card">
          <mat-card-header>
            <mat-card-title>{{ graph.bookName }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div [innerHTML]="graph.svgGraph"></div>
            <div class="syntax-header">
              <div class="syntax-header-buttons">
                <button
                  mat-raised-button
                  color="primary"
                  (click)="toggleMermaidSyntax()"
                >
                  <mat-icon>{{
                    isMermaidSyntaxVisible ? 'visibility_off' : 'visibility'
                  }}</mat-icon>
                  {{ isMermaidSyntaxVisible ? 'Hide' : 'Show' }} Mermaid Syntax
                </button>
                @if (isMermaidSyntaxVisible) {
                  <button
                    mat-raised-button
                    color="accent"
                    (click)="copyMermaidSyntax()"
                  >
                    <mat-icon>content_copy</mat-icon>
                    Copy Syntax
                  </button>
                }
                <button mat-raised-button color="primary" (click)="copyUrl()">
                  <mat-icon>link</mat-icon>
                  Copy URL
                </button>
              </div>
              @if (isMermaidSyntaxVisible) {
                <pre><code>{{ graph.mermaidSyntax }}</code></pre>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .loading-container,
      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        text-align: center;
      }

      .graph-card {
        width: 100%;
      }

      .syntax-header {
        margin-top: 2rem;
        padding: 1.5rem;
        background-color: #f8f9fa;
        border-radius: 8px;

        .syntax-header-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;

          button {
            display: flex;
            align-items: center;
            gap: 0.5rem;

            mat-icon {
              font-size: 1.2rem;
              height: 1.2rem;
              width: 1.2rem;
            }
          }
        }

        h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        pre {
          margin: 0;
          padding: 1.5rem;
          background-color: #fff;
          border-radius: 6px;
          border: 1px solid #e9ecef;
          overflow-x: auto;

          code {
            font-family: 'Fira Code', 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.6;
            color: #2d3748;
            white-space: pre-wrap;
            word-break: break-word;
          }
        }
      }
    `,
  ],
})
export default class SharePage implements OnInit {
  loading = true;
  error: string | null = null;
  graph: BookGraph | null = null;
  isMermaidSyntaxVisible = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly supabaseService: SupabaseService,
    private readonly sanitizer: DomSanitizer,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });
    const id = this.route.snapshot.params['id'];
    this.loadGraph(id);
  }

  toggleMermaidSyntax() {
    this.isMermaidSyntaxVisible = !this.isMermaidSyntaxVisible;
  }

  copyMermaidSyntax() {
    if (this.graph?.mermaidSyntax) {
      navigator.clipboard.writeText(this.graph.mermaidSyntax).then(() => {
        this.snackBar.open('Copied!', 'Close', {
          duration: 1500,
        });
      });
    }
  }

  copyUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('URL copied!', 'Close', {
        duration: 1500,
      });
    });
  }

  private loadGraph(id: string) {
    this.supabaseService
      .getGraphById(id)
      .pipe(
        switchMap(({ data, error }) => {
          if (error) throw new Error('Failed to load the graph');
          if (!data) throw new Error('Graph not found');

          return from(
            mermaid.render(
              'graph_' + Math.random().toString(36).substring(2, 15),
              data.mermaid_syntax,
            ),
          ).pipe(
            map(({ svg }) => ({
              id: data.id,
              bookName: data.book_name,
              svgGraph: this.sanitizer.bypassSecurityTrustHtml(svg),
              mermaidSyntax: data.mermaid_syntax,
            })),
          );
        }),
      )
      .subscribe({
        next: (graph) => {
          this.loading = false;
          this.graph = graph;
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err.message || 'An error occurred while loading the graph.';
        },
      });
  }
}
