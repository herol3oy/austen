import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class ClipboardService {
  constructor(private snackBar: MatSnackBar) {}

  copyToClipboard(text: string, message: string): Observable<boolean> {
    return of(null).pipe(
      map(() => {
        navigator.clipboard.writeText(text);
        this.snackBar.open(message, 'Close', { duration: 1500 });
        return true;
      }),
    );
  }
}
