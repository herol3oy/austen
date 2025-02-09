import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import mermaid from 'mermaid';
import { map, Observable } from 'rxjs';

import { MermaidSyntax } from '../types/mermaid-syntax';

const GET_MERMAID_SYNTAX_API_URL = '/api/v1/getMermaidSyntax';

@Injectable()
export class MermaidService {
  constructor(private readonly http: HttpClient) {}

  initializeMermaid() {
    mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'strict',
      theme: 'forest',
      look: 'handDrawn',
    });
  }

  getMermaidSyntax(
    bookTitle: string,
    authorName: string,
  ): Observable<MermaidSyntax> {
    return this.http
      .post<MermaidSyntax>(GET_MERMAID_SYNTAX_API_URL, {
        bookTitle,
        authorName,
      })
      .pipe(
        map(({ mermaidSyntax, emojis }) => ({
          mermaidSyntax,
          emojis,
        })),
      );
  }
}
