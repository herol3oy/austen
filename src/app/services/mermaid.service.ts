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
      securityLevel: 'loose',
      theme: 'forest',
      look: 'handDrawn',
      elk: {
        mergeEdges: true,
        nodePlacementStrategy: 'LINEAR_SEGMENTS',
      },
    });
  }

  getMermaidSyntax(bookTitle: string, authorName: string): Observable<string> {
    return this.http
      .post<MermaidSyntax>(GET_MERMAID_SYNTAX_API_URL, {
        bookTitle,
        authorName,
      })
      .pipe(map((res) => res.mermaidSyntax));
  }
}
