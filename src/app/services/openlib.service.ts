import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map, Observable } from 'rxjs';

import { Book } from '../types/book';
import { OpenLibraryResponse } from '../types/open-library-response';

@Injectable()
export class OpenlibService {
  constructor(private readonly http: HttpClient) {}

  searchBook(query: string): Observable<Book[]> {
    return this.http
      .get<OpenLibraryResponse>(
        `https://openlibrary.org/search.json?title=${query}`
      )
      .pipe(map((response) => response.docs));
  }
}
