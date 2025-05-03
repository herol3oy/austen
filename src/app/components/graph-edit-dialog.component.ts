import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { SupabaseService } from '../services/supabase.service';
import { BookGraph } from '../types/book-graph';

@Component({
  selector: 'austen-graph-edit-dialog',
  providers: [MermaidService, SupabaseService, LoadingStateService],
  imports: [
    MatDialogModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      Update {{ data.graph.bookName }} graph
    </h2>

    <mat-dialog-content class="dialog-content">
      <mat-form-field appearance="outline" class="form-field">
        <mat-label>Mermaid Syntax</mat-label>
        <textarea
          class="mermaid-syntax-textarea"
          matInput
          [(ngModel)]="data.graph.mermaidSyntax"
          (ngModelChange)="validateMermaidSyntax($event)"
          rows="10"
          [class.invalid]="!isValid"
          placeholder="Enter mermaid syntax here..."
        ></textarea>
        @if (!isValid) {
          <mat-error>Invalid Mermaid syntax</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!isValid"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form-field {
        width: 100%;
      }

      .mermaid-textarea-syntax.invalid {
        background-color: #f44336;
      }
    `,
  ],
})
export class GraphEditDialogComponent implements OnInit {
  isValid = true;

  constructor(
    private readonly dialogRef: MatDialogRef<GraphEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { graph: BookGraph },
    private readonly snackBar: MatSnackBar,
    private readonly mermaidService: MermaidService,
    private readonly supabaseService: SupabaseService,
    private readonly loadingStateService: LoadingStateService,
  ) {}

  ngOnInit(): void {
    this.validateMermaidSyntax(this.data.graph.mermaidSyntax);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.isValid) {
      this.supabaseService
        .updateGraph(this.data.graph.id, {
          mermaid_syntax: this.data.graph.mermaidSyntax,
        })
        .pipe(this.loadingStateService.spinUntilFinished())
        .subscribe({
          next: () => {
            this.dialogRef.close(this.data.graph.mermaidSyntax);
          },
          error: () => {
            this.snackBar.open(
              'Failed to update graph in the database',
              'Close',
              {
                duration: 3000,
              },
            );
          },
        });
    }
  }

  validateMermaidSyntax(syntax: string): void {
    const isMermaidGraphDiagram = syntax.trim().startsWith('graph ');

    if (!isMermaidGraphDiagram) {
      this.isValid = false;
      this.snackBar.open('Only "graph" type diagrams are supported', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.mermaidService.validateMermaidSyntax(syntax).subscribe({
      next: (isValid) => (this.isValid = isValid),
      error: () => {
        this.isValid = false;
        this.snackBar.open('Invalid Mermaid syntax', 'Close', {
          duration: 3000,
        });
      },
    });
  }
}
