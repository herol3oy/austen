import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  distinctUntilChanged,
  finalize,
  map,
  mergeMap,
  MonoTypeOperatorFunction,
  Observable,
  of,
  tap,
} from 'rxjs';

@Injectable()
export class LoadingStateService {
  private observablesCount: BehaviorSubject<number> = new BehaviorSubject(0);

  spinUntilFinished<T>(): MonoTypeOperatorFunction<T> {
    return (source: Observable<T>): Observable<T> => {
      return of(null).pipe(
        tap((): void => this.showSpinner()),
        mergeMap(
          (): Observable<T> =>
            source.pipe(finalize((): void => this.hideSpinner())),
        ),
      );
    };
  }

  isSpinnerVisible(): Observable<boolean> {
    return this.observablesCount.pipe(
      map((count: number): boolean => count > 0),
      distinctUntilChanged(),
    );
  }

  private showSpinner(): void {
    this.observablesCount.next(this.observablesCount.value + 1);
  }

  private hideSpinner(): void {
    this.observablesCount.next(this.observablesCount.value - 1);
  }
}
