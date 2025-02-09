import { Injectable } from '@angular/core';
import domtoimage from 'dom-to-image';
import { from, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable()
export class DownloadService {
  createSvg(svgString: string, fileName: string): Observable<void> {
    return of(null).pipe(
      map(() => {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }),
    );
  }

  createPng(svgElement: SVGElement, fileName: string): Observable<string> {
    return from(domtoimage.toPng(svgElement)).pipe(
      tap((dataUrl) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }),
    );
  }
}
