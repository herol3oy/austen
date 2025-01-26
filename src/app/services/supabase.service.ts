import { Injectable } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BookGraph } from '../types/book-graph';
import { StoredGraph } from '../types/stored-graph';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient = createBrowserClient(
    import.meta.env['VITE_PUBLIC_SUPABASE_URL'],
    import.meta.env['VITE_PUBLIC_SUPABASE_ANON_KEY'],
  );

  getAllGraphs(): Observable<StoredGraph[]> {
    return from(
      this.supabase
        .from('graphs')
        .select('*')
        .order('created_at', { ascending: false }),
    ).pipe(map((res) => res.data as StoredGraph[]));
  }

  getGraphById(id: string): Observable<StoredGraph> {
    return from(
      this.supabase.from('graphs').select('*').eq('id', id).single(),
    ).pipe(map((res) => res.data as StoredGraph));
  }

  saveGraph(graph: BookGraph): Observable<StoredGraph[]> {
    return from(
      this.supabase
        .from('graphs')
        .insert([
          {
            id: graph.id,
            book_name: graph.bookName,
            author_name: graph.authorName,
            svg_graph: graph.svgGraph,
            mermaid_syntax: graph.mermaidSyntax,
          },
        ])
        .select(),
    ).pipe(map((res) => res.data as StoredGraph[]));
  }
}
