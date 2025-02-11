import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { BookGraph } from '../types/book-graph';

@Component({
  selector: 'austen-graph-card',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
  ],
  template: `
    <mat-card class="graph-card">
      <mat-card-header>
        <mat-card-title>{{ graph.bookName }}</mat-card-title>
        <mat-card-subtitle>{{ graph.authorName }}</mat-card-subtitle>
        <mat-card-subtitle>{{ graph.emojis }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <code [innerHTML]="graph.svgGraph"></code>
      </mat-card-content>
      <mat-card-actions>
        <div class="action-buttons">
          <button mat-button color="primary" (click)="onView()">
            <mat-icon>visibility</mat-icon>
            View
          </button>

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

          @if (showCopyUrl) {
            <button mat-button color="primary" (click)="onCopyUrl()">
              <mat-icon>link</mat-icon>
              Copy URL
            </button>
          }

          @if (showCopySyntax && isSyntaxVisible) {
            <button mat-button color="accent" (click)="onCopySyntax()">
              <mat-icon>content_copy</mat-icon>
              Copy Syntax
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

      @if (showSyntaxToggle && isSyntaxVisible) {
        <mat-card-content>
          <pre><code>{{ graph.mermaidSyntax }}</code></pre>
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

    pre {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-top: 1rem;
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
export class GraphCardComponent {
  @Input({ required: true }) graph!: BookGraph;
  @Input() showDelete = false;
  @Input() showSyntaxToggle = false;
  @Input() showShare = false;
  @Input() showDownload = false;
  @Input() showCopyUrl = false;
  @Input() showCopySyntax = false;
  @Input() showPublicToggle = false;
  @Input() isPublic = false;

  @Output() view = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() downloadSvg = new EventEmitter<void>();
  @Output() downloadPng = new EventEmitter<void>();
  @Output() copyUrl = new EventEmitter<void>();
  @Output() copySyntax = new EventEmitter<void>();
  @Output() publicToggle = new EventEmitter<boolean>();
  @Output() toggleSyntax = new EventEmitter<void>();

  isSyntaxVisible = false;

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

  onCopyUrl() {
    this.copyUrl.emit();
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
}
