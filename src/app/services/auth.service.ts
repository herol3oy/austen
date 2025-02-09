import { computed, Injectable, signal } from '@angular/core';
import { createBrowserClient } from '@supabase/ssr';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService {
  private supabase = createBrowserClient(import.meta.env['VITE_PUBLIC_SUPABASE_URL'], import.meta.env['VITE_PUBLIC_SUPABASE_ANON_KEY']);
  private session = signal<unknown>(null);
  readonly loggedIn = computed(() => !!this.session());

  constructor() {
    this.refresh();

    this.supabase.auth.onAuthStateChange((_event) => {
      this.refresh();
    });
  }

  getSession() {
    return this.supabase.auth.getSession();
  }

  signUp(email: string, password: string): Observable<{ error: any }> {
    return from(
      this.supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      }),
    ).pipe(map(({ error }) => ({ error })));
  }

  signIn(email: string, password: string): Observable<{ error: any }> {
    return from(
      this.supabase.auth.signInWithPassword({
        email,
        password,
      }),
    ).pipe(map(({ error }) => ({ error })));
  }

  async logout() {
    await this.supabase.auth.signOut();
  }

  refresh() {
    this.getSession().then(({ data: { session } }) => {
      this.session.set(session);
    });
  }
}