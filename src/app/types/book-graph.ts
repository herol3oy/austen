import { SafeHtml } from '@angular/platform-browser';

export interface BookGraph {
  id: string;
  bookName: string;
  authorName: string;
  svgGraph: SafeHtml;
  mermaidSyntax: string;
  emojis: string;
}
