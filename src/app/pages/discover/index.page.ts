import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import mermaid from 'mermaid';
import { from, switchMap } from 'rxjs';

import { HeaderComponent } from '../../components/header/header.component';
import { SupabaseService } from '../../services/supabase.service';
import { BookGraph } from '../../types/book-graph';

@Component({
  standalone: true,
  providers: [SupabaseService],
  imports: [
    CommonModule,
    HeaderComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
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
