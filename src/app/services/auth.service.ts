import { computed, Injectable, signal } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService {
  private supabase = createBrowserClient(
    import.meta.env['VITE_PUBLIC_SUPABASE_URL'],
    import.meta.env['VITE_PUBLIC_SUPABASE_ANON_KEY'],
  );
  private session = signal<unknown>(null);
  readonly loggedIn = computed(() => !!this.session());
  readonly userEmail = computed(() => {
    const session = this.session() as { user?: { email?: string } } | null;
    return session?.user?.email || '';
  });

  constructor() {
    this.refresh();

    this.supabase.auth.onAuthStateChange(() => {
      this.refresh();
    });
  }

  getSession() {
    return this.supabase.auth.getSession();
  }

  signUp(email: string, password: string): Observable<void> {
    return from(
      this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      }),
    ).pipe(map(() => void 0));
  }

  signIn(email: string, password: string): Observable<void> {
    return from(
      this.supabase.auth.signInWithPassword({
        email,
        password,
      }),
    ).pipe(map(() => void 0));
  }

  logout(): Observable<void> {
    return from(this.supabase.auth.signOut()).pipe(map(() => void 0));
  }

  refresh() {
    this.getSession().then(({ data: { session } }) => {
      this.session.set(session);
    });
  }
}
