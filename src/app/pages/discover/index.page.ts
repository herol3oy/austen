import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import mermaid from 'mermaid';
import { from, switchMap } from 'rxjs';

import { HeaderComponent } from '../../components/header/header.component';
import { ClipboardService } from '../../services/clipboard.service';
import { MermaidService } from '../../services/mermaid.service';
import { SupabaseService } from '../../services/supabase.service';
import { BookGraph } from '../../types/book-graph';

@Component({
  standalone: true,
  providers: [SupabaseService, ClipboardService, MermaidService],
  imports: [
    CommonModule,
    HeaderComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.scss'],
})
export default class DiscaverPage implements OnInit {
  loading = true;
  error: string | null = null;
  graphs: BookGraph[] = [];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly clipboardService: ClipboardService,
    private readonly mermaidService: MermaidService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.mermaidService.initializeMermaid();

    this.loadGraphs();
  }

  navigateToGraph(id: string): void {
    this.router.navigate(['/share', id]);
  }

  copyUrl(id: string, event: MouseEvent): void {
    event.stopPropagation();

    const url = `${window.location.origin}/share/${id}`;

    this.clipboardService.copyToClipboard(url, 'URL copied!').subscribe();
  }

  copyMermaidSyntax(id: string, event: MouseEvent): void {
    event.stopPropagation();

    this.supabaseService
      .getGraphById(id)
      .pipe(
        switchMap((graph) =>
          this.clipboardService.copyToClipboard(
            graph.mermaid_syntax,
            'Syntax copied!',
          ),
        ),
      )
      .subscribe({
        error: (err) => {
          this.snackBar.open(err.message, 'Close', { duration: 1500 });
        },
      });
  }

  private loadGraphs(): void {
    this.supabaseService
      .getAllGraphs()
      .pipe(
        switchMap((data) => {
          if (!data) throw new Error('No graphs found');

          return from(
            Promise.all(
              data.map((graph) =>
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
                    emojis: graph.emojis,
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
