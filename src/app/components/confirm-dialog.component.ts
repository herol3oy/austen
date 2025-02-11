import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'austen-confirm-dialog',
  template: `
    <h2 mat-dialog-title>Delete Graph</h2>
    <mat-dialog-content>
      Are you sure you want to delete the graph for "{{ data.bookName }}" by
      "{{ data.authorName }}"?
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close cdkFocusInitial>Cancel</button>
      <button mat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
  imports: [MatDialogModule, MatButtonModule],
})
export class ConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { bookName: string; authorName: string },
  ) {}
}
