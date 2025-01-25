import { Injectable } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BookGraph } from '../types/book-graph';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createBrowserClient(
      import.meta.env['VITE_PUBLIC_SUPABASE_URL'],
      import.meta.env['VITE_PUBLIC_SUPABASE_ANON_KEY'],
    );
  }

  saveGraph(graph: BookGraph): Observable<{ data: any; error: any }> {
    if (!this.supabase) {
      return throwError(() => new Error('Supabase client not initialized'));
    }

    return from(
      this.supabase
        .from('graphs')
        .insert([
          {
            id: graph.id,
            book_name: graph.bookName,
            svg_graph: graph.svgGraph,
            mermaid_syntax: graph.mermaidSyntax,
          },
        ])
        .select(),
    ).pipe(
      catchError((error) => {
        console.error('Error saving graph:', error);
        return throwError(() => error);
      }),
    );
  }

  getGraphById(id: string): Observable<{ data: any; error: any }> {
    if (!this.supabase) {
      return throwError(() => new Error('Supabase client not initialized'));
    }

    return from(
      this.supabase.from('graphs').select('*').eq('id', id).single(),
    ).pipe(
      catchError((error) => {
        console.error('Error getting graph:', error);
        return throwError(() => error);
      }),
    );
  }
}
