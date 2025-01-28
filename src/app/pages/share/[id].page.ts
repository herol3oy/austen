import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import mermaid from 'mermaid';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BookGraph } from 'src/app/types/book-graph';

import { HeaderComponent } from '../../components/header/header.component';
import { ClipboardService } from '../../services/clipboard.service';
import { MermaidService } from '../../services/mermaid.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  standalone: true,
  providers: [SupabaseService, ClipboardService, MermaidService],
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    HeaderComponent,
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
    private readonly sanitizer: DomSanitizer,
    private readonly snackBar: MatSnackBar,
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
        .copyToClipboard(this.graph.mermaidSyntax, 'Syntax copied!')
        .subscribe();
    }
  }

  copyUrl() {
    const url = window.location.href;
    this.clipboardService.copyToClipboard(url, 'URL copied!').subscribe();
  }

  downloadSvg(): void {
    if (this.graph) {
      const svgElement = document.querySelector('svg');
      if (svgElement) {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const fileName = `${this.graph.bookName}-graph`;
        this.supabaseService.downloadSvg(svgString, fileName);
        this.snackBar.open('SVG downloaded!', 'Close', {
          duration: 1500,
        });
      }
    }
  }

  downloadPng(): void {
    if (this.graph) {
      const svgElement = document.querySelector('svg');
      if (svgElement) {
        const fileName = `${this.graph.bookName}-graph`;
        this.supabaseService.downloadPng(svgElement, fileName);
        this.snackBar.open('PNG downloaded!', 'Close', {
          duration: 1500,
        });
      }
    }
  }

  private loadGraph(id: string) {
    this.supabaseService
      .getGraphById(id)
      .pipe(
        switchMap((data) => {
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
              authorName: data.author_name,
              svgGraph: this.sanitizer.bypassSecurityTrustHtml(svg),
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
        error: (err) => {
          this.loading = false;
          this.error =
            err.message || 'An error occurred while loading the graph.';
        },
      });
  }
}
