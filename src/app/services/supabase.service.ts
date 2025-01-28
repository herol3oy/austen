import { Injectable } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import domtoimage from 'dom-to-image';
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
            emojis: graph.emojis,
          },
        ])
        .select(),
    ).pipe(map((res) => res.data as StoredGraph[]));
  }

  downloadSvg(svgString: string, fileName: string): void {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  downloadPng(svgElement: SVGElement, fileName: string): void {
    domtoimage
      .toPng(svgElement)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((error) => {
        console.error('Error converting SVG to PNG:', error);
      });
  }
}
