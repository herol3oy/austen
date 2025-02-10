import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

@Injectable()
export class ClipboardService {
  copyToClipboard(text: string): Observable<boolean> {
    return of(null).pipe(map(() => !!navigator.clipboard.writeText(text)));
  }
}
