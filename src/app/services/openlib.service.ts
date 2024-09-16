import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map, Observable } from 'rxjs';

import { Book } from '../types/book';
import { OpenLibraryResponse } from '../types/open-library-response';

const OPEN_LIBRARY_API_URL = 'https://openlibrary.org/search.json?title=';

@Injectable()
export class OpenlibService {
  constructor(private readonly http: HttpClient) {}

  searchBook(query: string): Observable<Book[]> {
    return this.http
      .get<OpenLibraryResponse>(`${OPEN_LIBRARY_API_URL}${query}`)
      .pipe(map((response) => response.docs));
  }
}
