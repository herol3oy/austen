import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';

import {
  debounceTime,
  finalize,
  from,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { MermaidService } from '../services/mermaid.service';
import { OpenlibService } from '../services/openlib.service';

import { Book } from '../types/book';
import { BookGraph } from '../types/book-graph';

import mermaid from 'mermaid';

@Component({
  selector: 'austen-home',
  standalone: true,
  providers: [OpenlibService, MermaidService],
  imports: [
    CommonModule,
    AsyncPipe,
    RouterOutlet,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatLabel,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './index.page.html',
  styleUrl: './index.page.scss',
})
export default class HomeComponent {
  loading = false;
  filteredOptions: Book[] = [];
  bookGraph: BookGraph | null = null;
  myControl = new FormControl<string>('', [
    Validators.required,
    Validators.minLength(4),
  ]);

  constructor(
    private readonly openLibService: OpenlibService,
    private readonly mermaidService: MermaidService,
    private readonly sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });

    this.myControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        switchMap((bookTitle) => {
          if (!bookTitle || !this.myControl.valid) {
            return of([]);
          } else {
            this.loading = true;
            return this.openLibService.searchBook(bookTitle).pipe(
              finalize(() => {
                this.loading = false;
              }),
            );
          }
        }),
      )
      .subscribe({
        next: (books) => {
          this.filteredOptions = books.map(({ title, author_name }) => ({
            title,
            author_name,
          }));
        },
      });
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent) {
    const selectedBook = event.option.value;
    this.displayGraph(selectedBook);
  }

  clearSearch() {
    this.myControl.setValue('');
    this.filteredOptions = [];
    this.bookGraph = null;
  }

  displayGraph(bookTitle: string) {
    this.mermaidService
      .getMermaidContent(bookTitle)
      .pipe(
        switchMap((mermaidSyntax) => {
          return from(
            mermaid.render(
              'graph_' + Math.random().toString(36).substring(2, 15),
              mermaidSyntax,
            ),
          );
        }),
        map(({ svg }) => {
          return this.sanitizer.bypassSecurityTrustHtml(svg);
        }),
      )
      .subscribe({
        next: (mermaidSyntax) => {
          this.bookGraph = {
            id: crypto.randomUUID(),
            bookName: bookTitle,
            svgGraph: mermaidSyntax,
          };
          this.cdr.detectChanges();
        },
      });
  }
}
