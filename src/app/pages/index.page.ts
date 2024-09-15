import { AsyncPipe, CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Injectable } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterModule, RouterOutlet } from '@angular/router';
import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import mermaid from 'mermaid';
import {
  catchError,
  debounceTime,
  finalize,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';

interface Book {
  title: string;
  author_name: string[];
}

interface OpenLibraryResponse {
  docs: Book[];
}

interface BookGraph {
  id: string;
  bookName: string;
  svgGraph: SafeHtml;
}

@Injectable()
export class BookSearchService {
  constructor(private readonly http: HttpClient) {}

  searchBooks(query: string): Observable<Book[]> {
    return this.http
      .get<OpenLibraryResponse>(
        `https://openlibrary.org/search.json?title=${query}`
      )
      .pipe(map((response) => response.docs));
  }
}

@Injectable()
export class MermaidService {
  private readonly googleGeminiApiKey = import.meta.env[
    'VITE_GOOGLE_GEMINI_API_KEY'
  ];
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private systemInstruction = `
     You're a bookworm and an assistant. You'll provide the name of a book,
      and you will create a graph for its characters using Mermaid js syntax. 
      You can find the following as a sample for the book "The Wonderful Wizard of Oz". 
      Please refrain from including any explanations or descriptions at the beginning or end and 
      avoid adding notes or anything else and simply provide the syntax. 
      Do not include syntax highlighting for the syntax.

        graph TD
          A[Dorothy Gale] -->|Pet| B[Toto]
          A -->|Family| C[Uncle Henry and Aunt Em]
          A -->|Friends| D[Scarecrow]
          A -->|Friends| E[Tin Woodman]
          A -->|Friends| F[Cowardly Lion]
          A -->|Enemy| G[The Wicked Witch of The West]
          A -->|Enemy| H[The Wizard of OZ]
          A -->|Helps Dorothy| I[Glinda]
          D -->|Friends| E
          E -->|Friends| F
          B -->|In Kansas| C
          `;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.googleGeminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: this.systemInstruction,
    });
  }

  getMermaidContent(bookTitle: string): Observable<string> {
    return from(this.model.generateContent(bookTitle)).pipe(
      map((result) => result.response.text()),
      catchError((error) => {
        console.error('Error generating content:', error);
        throw error;
      })
    );
  }
}

@Component({
  selector: 'app-home',
  standalone: true,
  providers: [BookSearchService, MermaidService],
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
      @if (bookGraph.bookName && bookGraph.svgGraph) {
      <mat-card class="book-graph-card">
        <mat-card-header>
          <mat-card-title>{{ bookGraph.bookName }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div [innerHTML]="bookGraph.svgGraph"></div>
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
  styles: [
    `
      :host {
        display: block;
        font-family: 'Roboto', sans-serif;
        background-color: #f0f4f8;
        min-height: 100vh;
        padding: 2rem;
      }

      .spinner-container {
        display: flex;
        align-items: center;
      }

      .spinner-container span {
        margin-left: 0.5rem;
      }

      .austen-header {
        text-align: center;
        margin-bottom: 2rem;
        color: #2c3e50;
      }

      h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        font-weight: 300;
      }

      .subtitle {
        font-size: 1.2rem;
        color: #7f8c8d;
      }

      .search-form {
        display: flex;
        justify-content: center;
        margin-bottom: 2rem;
      }

      mat-form-field {
        width: 100%;
        max-width: 40rem;
      }

      .book-graph-section {
        display: flex;
      }

      .book-graph-card {
        width: 100%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .loading-container,
      .no-graph-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        height: 20rem;
        color: #7f8c8d;
        width: 100vw;
      }

      .no-graph-container mat-icon {
        font-size: 3rem;
        height: 3rem;
        width: 3rem;
        margin-bottom: 1rem;
      }

      .explore-icon {
        animation: swing 4s ease-in-out infinite;
      }

      @keyframes swing {
        0% {
          transform: rotate(30deg);
        }
        50% {
          transform: rotate(-30deg);
        }
        100% {
          transform: rotate(30deg);
        }
      }

      @media (max-width: 600px) {
        :host {
          padding: 1rem;
        }

        h1 {
          font-size: 2rem;
        }

        .subtitle {
          font-size: 1rem;
        }
      }
    `,
  ],
})
export default class HomeComponent {
  bookName = '';
  loading = false;
  options: string[] = [];
  filteredOptions: Book[] = [];
  bookGraph: BookGraph = { id: '', bookName: '', svgGraph: '' };
  myControl = new FormControl<string>('', [
    Validators.required,
    Validators.minLength(4),
  ]);

  constructor(
    private readonly bookSearchService: BookSearchService,
    private readonly mermaidService: MermaidService,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' });

    this.myControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        switchMap((value) => {
          if (!value || !this.myControl.valid) {
            return of([]);
          } else {
            this.loading = true;
            this.filteredOptions = [];
            return this.bookSearchService.searchBooks(value).pipe(
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

  onOptionSelected(event: any) {
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
        },
      });
  }
}
