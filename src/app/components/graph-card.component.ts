import 'prismjs/components/prism-mermaid';
import 'prismjs/themes/prism-coy.min.css';

import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as Prism from 'prismjs';

import { SupabaseAuthService } from '../services/auth.service';
import { MermaidService } from '../services/mermaid.service';
import { BookGraph } from '../types/book-graph';
import { GraphEditDialogComponent } from './graph-edit-dialog.component';

@Component({
  selector: 'austen-graph-card',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  providers: [MermaidService, SupabaseAuthService],
  template: `
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
          @if (showView) {
            <button mat-button color="primary" (click)="onView()">
              <mat-icon>visibility</mat-icon>
              View
            </button>
          }

          @if (showDelete) {
            <button mat-button color="warn" (click)="onDelete()">
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          }

          @if (showSyntaxToggle) {
            <button mat-button color="primary" (click)="onToggleSyntax()">
              <mat-icon>{{
                isSyntaxVisible ? 'visibility_off' : 'visibility'
              }}</mat-icon>
              {{ isSyntaxVisible ? 'Hide' : 'Show' }} Syntax
            </button>
          }

          @if (showShare) {
            <button mat-button color="primary" (click)="onShare()">
              <mat-icon>share</mat-icon>
              Share
            </button>
          }

          @if (showDownload) {
            <button mat-button [matMenuTriggerFor]="downloadMenu">
              <mat-icon>download</mat-icon>
              Download
            </button>
            <mat-menu #downloadMenu="matMenu">
              <button mat-menu-item (click)="onDownloadSvg()">
                <mat-icon>image</mat-icon>
                Download SVG
              </button>
              <button mat-menu-item (click)="onDownloadPng()">
                <mat-icon>image</mat-icon>
                Download PNG
              </button>
            </mat-menu>
          }

          @if (showCopySyntax && isSyntaxVisible) {
            <button mat-button color="accent" (click)="onCopySyntax()">
              <mat-icon>content_copy</mat-icon>
              Copy Syntax
            </button>
          }

          @if (showEditSyntax) {
            <button mat-button color="primary" (click)="openEditGraphDialog()">
              <mat-icon>edit</mat-icon>
              Edit Graph
            </button>
          }
        </div>

        @if (showPublicToggle) {
          <mat-slide-toggle
            [checked]="isPublic"
            (change)="onPublicToggle($event.checked)"
            color="primary"
          >
            {{ isPublic ? 'Public' : 'Private' }}
          </mat-slide-toggle>
        }
      </mat-card-actions>

      @if (showCopyUrl) {
        <mat-card-content class="url-section">
          <mat-form-field appearance="outline" class="url-field">
            <mat-label>Share URL</mat-label>
            <input
              matInput
              #urlInput
              [value]="graphUrl"
              (click)="onCopyUrl(urlInput)"
              readonly
            />
            <button
              mat-icon-button
              matSuffix
              (click)="onCopyUrl(urlInput)"
              [matTooltip]="'Copy URL'"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </mat-form-field>
        </mat-card-content>
      }

      @if ((showSyntaxToggle && isSyntaxVisible) || alwaysShowSyntax) {
        <mat-card-content>
          <pre>
            <code [innerHTML]="highlightedCode"></code>
          </pre>
        </mat-card-content>
      }
    </mat-card>
  `,
  styles: `
    .graph-card {
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
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
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .url-field {
      width: 100%;
    }

    pre {
      padding: 1rem;
      overflow-x: auto;
    }

    @media (max-width: 768px) {
      .action-buttons {
        flex-direction: column;
        width: 100%;
      }

      button {
        width: 100%;
      }

      mat-card-actions {
        flex-direction: column;
        gap: 1rem;
      }
    }
  `,
})
export class GraphCardComponent implements OnInit {
  @Input({ required: true }) graph!: BookGraph;
  @Input() showView = true;
  @Input() showDelete = false;
  @Input() showSyntaxToggle = false;
  @Input() showShare = false;
  @Input() showDownload = false;
  @Input() showCopyUrl = false;
  @Input() showCopySyntax = false;
  @Input() showPublicToggle = false;
  @Input() showEditSyntax = true;
  @Input() isPublic = false;
  @Input() alwaysShowSyntax = false;

  @Output() view = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() downloadSvg = new EventEmitter<void>();
  @Output() downloadPng = new EventEmitter<void>();
  @Output() copyUrl = new EventEmitter<string>();
  @Output() copySyntax = new EventEmitter<void>();
  @Output() publicToggle = new EventEmitter<boolean>();
  @Output() toggleSyntax = new EventEmitter<void>();
  @Output() syntaxChange = new EventEmitter<string>();

  isSyntaxVisible = false;
  highlightedCode = '';
  graphUrl = '';

  constructor(
    private readonly mermaidService: MermaidService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: SupabaseAuthService,
  ) {}

  ngOnInit() {
    this.highlightCode();
    this.constructGraphUrl();
    if (this.alwaysShowSyntax) {
      this.isSyntaxVisible = true;
    }
  }

  onView() {
    this.view.emit();
  }

  onDelete() {
    this.delete.emit();
  }

  onShare() {
    this.share.emit();
  }

  onDownloadSvg() {
    this.downloadSvg.emit();
  }

  onDownloadPng() {
    this.downloadPng.emit();
  }

  onCopyUrl(inputElement: HTMLInputElement) {
    inputElement.select();
    inputElement.setSelectionRange(0, inputElement.value.length);
    this.copyUrl.emit(this.graph.id);
  }

  onCopySyntax() {
    this.copySyntax.emit();
  }

  onPublicToggle(isPublic: boolean) {
    this.publicToggle.emit(isPublic);
  }

  onToggleSyntax() {
    this.isSyntaxVisible = !this.isSyntaxVisible;
    this.toggleSyntax.emit();
  }

  openEditGraphDialog(): void {
    if (!this.authService.loggedIn()) {
      this.snackBar.open('Please login to edit the graph.', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.dialog
      .open(GraphEditDialogComponent, {
        data: { graph: this.graph },
        width: '600px',
        minHeight: '400px',
        maxHeight: '90vh',
      })
      .afterClosed()
      .subscribe({
        next: (result: string) => {
          this.updateGraph(result);
        },
        error: () => {
          this.snackBar.open('An error occurred while editing the graph.', 'Close', {
              duration: 3000,
          });
        }
      });
  }

  private updateGraph(syntax: string): void {
    this.mermaidService.renderMermaid(syntax).subscribe({
      next: (svgGraph) => {
        this.graph = { ...this.graph, mermaidSyntax: syntax, svgGraph };
        this.highlightCode();
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Invalid Mermaid syntax', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  private highlightCode() {
    if (this.graph.mermaidSyntax) {
      this.highlightedCode = Prism.highlight(
        this.graph.mermaidSyntax,
        Prism.languages['mermaid'],
        'mermaid',
      );
    }
  }

  private constructGraphUrl() {
    const baseUrl = window.location.origin;
    this.graphUrl = `${baseUrl}/${this.graph.id}`;
  }
}
