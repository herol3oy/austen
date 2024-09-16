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
    RouterOutlet,
    CommonModule,
    AsyncPipe,
    RouterModule,
    MatButtonModule,
    FormsModule,
    MatLabel,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <header class="austen-header">
      <h1>Austen</h1>
      <p class="subtitle">Discover Story Relationships</p>
    </header>

    <form class="search-form">
      <mat-form-field appearance="outline">
        <mat-label>Type a book title...</mat-label>
        <input
          type="text"
          matInput
          [formControl]="myControl"
          [matAutocomplete]="auto"
          name="bookTitle"
          required
        />

        @if (myControl.value) {
        <button
          matSuffix
          mat-icon-button
          aria-label="Clear"
          (click)="clearSearch()"
        >
          <mat-icon>close</mat-icon>
        </button>
        }
        <mat-icon matSuffix>book</mat-icon>
        <mat-autocomplete
          #auto="matAutocomplete"
          (optionSelected)="onOptionSelected($event)"
        >
          @for (option of filteredOptions; track option) {
          <mat-option [value]="option.title">
            {{ option.title }}
            <mat-chip-option color="accent">
              {{ option.author_name }}
            </mat-chip-option>
          </mat-option>
          } @if (!filteredOptions.length && !loading) {
          <mat-option disabled>
            <em>No books found in this realm...</em>
          </mat-option>
          } @if (loading) {
          <mat-option disabled>
            <div class="spinner-container">
              <mat-spinner diameter="20"></mat-spinner>
              <span>Searching the literary cosmos...</span>
            </div>
          </mat-option>

          }
        </mat-autocomplete>
        @if (myControl.hasError('required')) {
        <mat-error>A book title is required to begin your journey</mat-error>
        } @if (myControl.hasError('minlength')) {
        <mat-error
          >Book titles must be at least 4 characters to unlock their
          secrets</mat-error
        >
        }
      </mat-form-field>
    </form>

    <section class="book-graph-section">
      @if (bookGraph?.bookName && bookGraph?.svgGraph) {
      <mat-card class="book-graph-card">
        <mat-card-header>
          <mat-card-title>{{ bookGraph?.bookName }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div [innerHTML]="bookGraph?.svgGraph"></div>
        </mat-card-content>
      </mat-card>
      } @else if (loading) {
      <div class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Weaving the threads of literary connections...</p>
      </div>
      } @else {
      <div class="no-graph-container">
        <mat-icon class="explore-icon">explore</mat-icon>
        <p>Your literary map awaits. Start by searching for a book above!</p>
      </div>
      }
    </section>
  `,
  styleUrl: './index.page.scss',
})
export default class HomeComponent {
  bookName = '';
  loading = false;
  options: string[] = [];
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
    private cdr: ChangeDetectorRef
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
            this.filteredOptions = [];
            return this.openLibService.searchBook(bookTitle).pipe(
              finalize(() => {
                this.loading = false;
              })
            );
          }
        })
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
    this.bookGraph = { id: '', bookName: '', svgGraph: '' };
  }

  displayGraph(bookTitle: string) {
    this.mermaidService
      .getMermaidContent(bookTitle)
      .pipe(
        switchMap((content) => {
          return from(
            mermaid.render(
              'graph_' + Math.random().toString(36).substring(2, 15),
              content
            )
          );
        }),
        map(({ svg }) => {
          return this.sanitizer.bypassSecurityTrustHtml(svg);
        })
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
