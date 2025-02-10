import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import mermaid from 'mermaid';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class MermaidRenderService {
  constructor(private readonly sanitizer: DomSanitizer) {}

  renderMermaid(syntax: string): Observable<SafeHtml> {
    const graphId = `graph_${crypto.randomUUID()}`;
    return from(mermaid.render(graphId, syntax)).pipe(
      map(({ svg }) => this.sanitizer.bypassSecurityTrustHtml(svg)),
    );
  }
}
