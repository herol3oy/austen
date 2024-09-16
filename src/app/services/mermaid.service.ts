import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { catchError, map, Observable } from 'rxjs';

import { MermaidContent } from '../types/mermaid-content';

@Injectable()
export class MermaidService {
  constructor(private readonly http: HttpClient) {}

  getMermaidContent(bookTitle: string): Observable<string> {
    return this.http
      .post<MermaidContent>('/api/v1/getMermaidContent', {
        bookTitle,
      })
      .pipe(
        map((res) => res.mermaidContent),
        catchError((err) => {
          console.error('Error fetching Mermaid content:', err);
          throw err;
        }),
      );
  }
}
