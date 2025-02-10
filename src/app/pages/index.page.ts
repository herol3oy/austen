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
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import mermaid from 'mermaid';
import {
  debounceTime,
  finalize,
  from,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { SupabaseAuthService } from '../services/auth.service';
import { ClipboardService } from '../services/clipboard.service';
import { DownloadService } from '../services/download.service';
import { MermaidService } from '../services/mermaid.service';
import { OpenlibService } from '../services/openlib.service';
import { SupabaseService } from '../services/supabase.service';
import { Book } from '../types/book';
import { BookGraph } from '../types/book-graph';

@Component({
  selector: 'app-home',
  standalone: true,
  providers: [
    OpenlibService,
    MermaidService,
    SupabaseService,
    ClipboardService,
    SupabaseAuthService,
    DownloadService,
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
  ],
  templateUrl: './index.page.html',
  styleUrl: './index.page.scss',
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
    private readonly sanitizer: DomSanitizer,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: SupabaseAuthService,
  ) {}

  ngOnInit(): void {
    this.mermaidService.initializeMermaid();

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
          this.filteredOptions = books.map(({ title, author_name }) => ({
            title,
            author_name,
          }));
        },
      });
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent) {
    this.isOptionSelected = true;

    const selectedBook = this.filteredOptions.find(
      (book) => book.title === event.option.value,
    );
    if (selectedBook) {
      this.displayGraph(selectedBook.title, selectedBook.author_name[0]);
    }
  }

  clearSearch() {
    this.myControl.setValue('');
    this.filteredOptions = [];
    this.bookGraph = null;
  }

  displayGraph(bookTitle: string, authorName: string) {
    this.graphLoading = true;
    this.mermaidService
      .getMermaidSyntax(bookTitle, authorName)
      .pipe(
        switchMap(({ mermaidSyntax, emojis }) => {
          return from(
            mermaid.render(
              'graph_' + Math.random().toString(36).substring(2, 15),
              mermaidSyntax,
            ),
          ).pipe(
            map(({ svg }) => ({
              svg: this.sanitizer.bypassSecurityTrustHtml(svg),
              mermaidSyntax,
              emojis,
            })),
          );
        }),
        finalize(() => {
          this.graphLoading = false;
        }),
      )

      .subscribe({
        next: ({ svg, mermaidSyntax, emojis }) => {
          this.bookGraph = {
            id: crypto.randomUUID(),
            bookName: bookTitle,
            authorName,
            svgGraph: svg,
            mermaidSyntax,
            emojis,
          };
          this.cdr.detectChanges();
        },
      });
  }

  toggleMermaidSyntax() {
    this.isMermaidSyntaxVisible = !this.isMermaidSyntaxVisible;
    this.cdr.detectChanges();
  }

  copyMermaidSyntax() {
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

  async shareGraph() {
    if (!this.bookGraph) return;

    if (!this.authService.loggedIn()) {
      this.snackBar
        .open('Please login to save and share graphs', 'Login', {
          duration: 3000,
        })
        .onAction()
        .subscribe(() => {
          this.router.navigate(['/login']);
        });
      return;
    }

    this.supabaseService.saveGraph(this.bookGraph).subscribe({
      next: () => {
        this.router.navigate(['/share', this.bookGraph!.id]);
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
}
