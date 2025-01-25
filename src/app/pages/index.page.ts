import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';

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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

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
import { SupabaseService } from '../services/supabase.service';

import { Book } from '../types/book';
import { BookGraph } from '../types/book-graph';

import mermaid from 'mermaid';

@Component({
  selector: 'austen-home',
  standalone: true,
  providers: [OpenlibService, MermaidService, SupabaseService],
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
  isMermaidSyntaxVisible = false;

  constructor(
    private readonly openLibService: OpenlibService,
    private readonly mermaidService: MermaidService,
    private readonly supabaseService: SupabaseService,
    private readonly sanitizer: DomSanitizer,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
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
      .getMermaidSyntax(bookTitle)
      .pipe(
        switchMap((mermaidSyntax) => {
          return from(
            mermaid.render(
              'graph_' + Math.random().toString(36).substring(2, 15),
              mermaidSyntax,
            ),
          ).pipe(
            map(({ svg }) => ({
              svg: this.sanitizer.bypassSecurityTrustHtml(svg),
              mermaidSyntax,
            })),
          );
        }),
      )
      .subscribe({
        next: ({ svg, mermaidSyntax }) => {
          this.bookGraph = {
            id: crypto.randomUUID(),
            bookName: bookTitle,
            svgGraph: svg,
            mermaidSyntax,
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
      navigator.clipboard.writeText(this.bookGraph.mermaidSyntax).then(() => {
        this.snackBar.open('Copied!', 'Close', {
          duration: 1500,
        });
      });
    }
  }

  async shareGraph() {
    if (!this.bookGraph) return;

    try {
      const result = await this.supabaseService
        .saveGraph(this.bookGraph)
        .toPromise();

      if (result?.error) {
        throw result.error;
      }

      await this.router.navigate(['/share', this.bookGraph.id]);

      this.snackBar.open('Graph shared successfully!', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    } catch (error) {
      console.error('Error sharing graph:', error);
      this.snackBar.open('Failed to share graph. Please try again.', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    }
  }
}
