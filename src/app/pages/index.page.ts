import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, finalize, of, startWith, switchMap } from 'rxjs';

import { GraphCardComponent } from '../components/graph-card.component';
import { SupabaseAuthService } from '../services/auth.service';
import { ClipboardService } from '../services/clipboard.service';
import { DownloadService } from '../services/download.service';
import { LoadingStateService } from '../services/loadingState.service';
import { MermaidService } from '../services/mermaid.service';
import { MermaidRenderService } from '../services/mermaid-render.service';
import { OpenlibService } from '../services/openlib.service';
import { SupabaseService } from '../services/supabase.service';
import { Book } from '../types/book';
import { BookGraph } from '../types/book-graph';

@Component({
  selector: 'austen-home',
  providers: [
    OpenlibService,
    MermaidService,
    SupabaseService,
    ClipboardService,
    SupabaseAuthService,
    DownloadService,
    MermaidRenderService,
  ],
  imports: [
    CommonModule,
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
    MatSnackBarModule,
    MatMenuModule,
    GraphCardComponent,
  ],
  template: `
    <div class="page-container">
      <form class="search-form">
        <mat-form-field appearance="outline">
          <mat-label>Type a book title...</mat-label>
          <input
            type="text"
            matInput
            [formControl]="myControl"
            [matAutocomplete]="auto"
            name="bookTitle"
            (keydown.enter)="$event.preventDefault()"
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
                <div class="book-option">
                  <span class="book-title">{{ option.title }}</span>
                  <mat-chip-option color="accent" class="author-chip">
                    {{ option.author_name }}
                  </mat-chip-option>
                </div>
              </mat-option>
            }
            @if (!filteredOptions.length && !loading) {
              <mat-option disabled>
                <em>No books found in this realm...</em>
              </mat-option>
            }
            @if (loading) {
              <mat-option disabled>
                <div class="spinner-container">
                  <mat-spinner diameter="20"></mat-spinner>
                  <span>Searching the literary cosmos...</span>
                </div>
              </mat-option>
            }
          </mat-autocomplete>
          @if (myControl.hasError('required')) {
            <mat-error
              >A book title is required to begin your journey</mat-error
            >
          }
          @if (myControl.hasError('minlength')) {
            <mat-error
              >Book titles must be at least 4 characters to unlock their
              secrets</mat-error
            >
          }
        </mat-form-field>
      </form>

      <section>
        @if (bookGraph?.bookName && bookGraph?.svgGraph) {
          <austen-graph-card
            [graph]="bookGraph!"
            [showView]="false"
            [showSyntaxToggle]="true"
            [showShare]="true"
            [showDownload]="true"
            [showCopySyntax]="true"
            (share)="shareGraph()"
            (downloadSvg)="downloadSvg()"
            (downloadPng)="downloadPng()"
            (copySyntax)="copyMermaidSyntax()"
            (toggleSyntax)="toggleMermaidSyntax()"
          />
        } @else if (loading || graphLoading) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Weaving the threads of literary connections...</p>
          </div>
        } @else {
          <div class="no-graph-container">
            <mat-icon class="explore-icon">explore</mat-icon>
            <p>
              Your literary map awaits. Start by searching for a book above!
            </p>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .spinner-container {
      display: flex;
      align-items: center;
    }

    .spinner-container span {
      margin-left: 0.5rem;
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

    .loading-container,
    .no-graph-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      height: 20rem;
      color: #7f8c8d;
      width: 100%;
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

    .book-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: 1rem;

      .book-title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .author-chip {
        flex-shrink: 0;
      }
    }

    ::ng-deep {
      .mat-mdc-option {
        .mdc-list-item__primary-text {
          width: 100%;
        }
      }

      .mat-mdc-chip-option {
        --mdc-chip-container-height: 24px;
      }
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
  `,
})
export default class HomeComponent implements OnInit {
  loading = false;
  graphLoading = false;
  filteredOptions: Book[] = [];
  bookGraph: BookGraph | null = null;
  myControl = new FormControl<string>('', [
    Validators.required,
    Validators.minLength(4),
  ]);
  isMermaidSyntaxVisible = false;
  isOptionSelected = false;

  constructor(
    private readonly openLibService: OpenlibService,
    private readonly mermaidService: MermaidService,
    private readonly supabaseService: SupabaseService,
    private readonly downloadService: DownloadService,
    private readonly clipboardService: ClipboardService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: SupabaseAuthService,
    private readonly mermaidRenderService: MermaidRenderService,
    private readonly loadingStateService: LoadingStateService,
  ) {}

  ngOnInit(): void {
    this.mermaidService.initializeMermaid();
    this.initializeBookSearch();
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.isOptionSelected = true;

    const selectedBook = this.filteredOptions.find(
      (book) => book.title === event.option.value,
    );
    if (selectedBook) {
      this.displayGraph(selectedBook.title, selectedBook.author_name[0]);
    }
  }

  clearSearch(): void {
    this.myControl.setValue('');
    this.filteredOptions = [];
    this.bookGraph = null;
  }

  displayGraph(bookTitle: string, authorName: string): void {
    this.graphLoading = true;
    this.mermaidService
      .getMermaidSyntax(bookTitle, authorName)
      .pipe(
        this.loadingStateService.spinUntilFinished(),
        switchMap(({ mermaidSyntax, emojis }) => {
          return this.mermaidRenderService.renderMermaid(mermaidSyntax).pipe(
            this.loadingStateService.spinUntilFinished(),
            switchMap((svgGraph) => of({ svgGraph, mermaidSyntax, emojis })),
          );
        }),
        finalize(() => {
          this.graphLoading = false;
        }),
      )
      .subscribe({
        next: ({ svgGraph, mermaidSyntax, emojis }) => {
          this.bookGraph = {
            id: crypto.randomUUID(),
            bookName: bookTitle,
            authorName,
            svgGraph,
            mermaidSyntax,
            emojis,
          };
          this.cdr.detectChanges();
        },
      });
  }

  toggleMermaidSyntax(): void {
    this.isMermaidSyntaxVisible = !this.isMermaidSyntaxVisible;
    this.cdr.detectChanges();
  }

  copyMermaidSyntax(): void {
    if (this.bookGraph?.mermaidSyntax) {
      this.clipboardService
        .copyToClipboard(this.bookGraph.mermaidSyntax)
        .subscribe({
          next: () => {
            this.snackBar.open('Syntax copied!', 'Close', {
              duration: 1500,
            });
          },
          error: () => {
            this.snackBar.open('Failed to copy syntax', 'Close', {
              duration: 1500,
            });
          },
        });
    }
  }

  shareGraph(): void {
    if (!this.bookGraph) return;

    if (!this.authService.loggedIn()) {
      this.snackBar.open('Please login to save and share graphs', 'Login', {
        duration: 3000,
      });
      return;
    }

    this.supabaseService.saveGraph(this.bookGraph).subscribe({
      next: () => {
        this.router.navigate(['/', this.bookGraph!.id]);
        this.snackBar.open('Graph shared successfully!', 'Close', {
          duration: 3000,
        });
      },
      error: (error) => {
        if (error.message === 'User not authenticated') {
          this.router.navigate(['/login']);
          this.snackBar.open('Please login to save graphs', 'Close', {
            duration: 3000,
          });
        } else {
          this.snackBar.open(
            'Failed to share graph. Please try again.',
            'Close',
            {
              duration: 3000,
            },
          );
        }
      },
    });
  }

  downloadSvg(): void {
    if (!this.bookGraph) return;

    if (!this.authService.loggedIn()) {
      this.snackBar.open('Please login to download graphs', 'Login', {
        duration: 3000,
      });

      return;
    }

    const svgElement = document.querySelector('svg');
    if (svgElement) {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const fileName = `${this.bookGraph.bookName}-graph`;
      this.downloadService.createSvg(svgString, fileName).subscribe({
        next: () => {
          this.snackBar.open('SVG downloaded!', 'Close', {
            duration: 3000,
          });
        },
        error: () => {
          this.snackBar.open('Failed to download SVG', 'Close', {
            duration: 3000,
          });
        },
      });
    }
  }

  downloadPng(): void {
    if (this.bookGraph) {
      const svgElement = document.querySelector('svg');
      if (svgElement) {
        const fileName = `${this.bookGraph.bookName}-graph`;
        this.downloadService.createPng(svgElement, fileName).subscribe({
          next: () => {
            this.snackBar.open('PNG downloaded!', 'Close', {
              duration: 3000,
            });
          },
          error: () => {
            this.snackBar.open('Failed to download PNG', 'Close', {
              duration: 3000,
            });
          },
        });
      }
    }
  }

  private initializeBookSearch(): void {
    this.myControl.valueChanges
      .pipe(
        startWith(''),
        debounceTime(400),
        switchMap((bookTitle) => {
          if (this.isOptionSelected) {
            this.isOptionSelected = false;
            return of([]);
          }

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
          this.filteredOptions = books;
        },
      });
  }
}
