import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { MermaidSyntax } from '../types/mermaid-syntax';

const GET_MERMAID_SYNTAX_API_URL = '/api/v1/getMermaidSyntax';

@Injectable()
export class MermaidService {
  constructor(private readonly http: HttpClient) {}

  getMermaidSyntax(bookTitle: string): Observable<string> {
    return this.http
      .post<MermaidSyntax>(GET_MERMAID_SYNTAX_API_URL, { bookTitle })
      .pipe(map((res) => res.mermaidSyntax));
  }
}
