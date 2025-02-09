import { Injectable } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, switchMap } from 'rxjs';
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

  getPublicGraphs(): Observable<StoredGraph[]> {
    return from(
      this.supabase
        .from('graphs')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false }),
    ).pipe(map((res) => res.data as StoredGraph[]));
  }

  getUserGraphs(userId: string): Observable<StoredGraph[]> {
    return from(
      this.supabase
        .from('graphs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ).pipe(map((res) => res.data as StoredGraph[]));
  }

  getGraphById(id: string): Observable<StoredGraph> {
    return from(
      this.supabase.from('graphs').select('*').eq('id', id).single(),
    ).pipe(map((res) => res.data as StoredGraph));
  }

  saveGraph(
    graph: BookGraph,
    isPublic: boolean = false,
  ): Observable<StoredGraph[]> {
    return from(this.supabase.auth.getUser()).pipe(
      switchMap(({ data: { user } }) => {
        if (!user) {
          throw new Error('User not authenticated');
        }
  
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
                emojis: graph.emojis,
                user_id: user.id,
                is_public: isPublic,
              },
            ])
            .select(),
        ).pipe(map((res) => res.data as StoredGraph[]));
      }),
    );
  }

  toggleGraphPublicStatus(
    graphId: string,
    isPublic: boolean,
  ): Observable<StoredGraph> {
    return from(
      this.supabase
        .from('graphs')
        .update({ is_public: isPublic })
        .eq('id', graphId)
        .select()
        .single(),
    ).pipe(map((res) => res.data as StoredGraph));
  }

  deleteGraph(graphId: string): Observable<void> {
    return from(this.supabase.from('graphs').delete().eq('id', graphId)).pipe(
      map(() => void 0),
    );
  }
}
