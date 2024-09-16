import { SafeHtml } from '@angular/platform-browser';

export interface BookGraph {
  id: string;
  bookName: string;
  svgGraph: SafeHtml;
}
