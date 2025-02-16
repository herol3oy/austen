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
  readonly username = computed(() => {
    const session = this.session() as {
      user?: {
        user_metadata?: {
          user_name?: string;
          preferred_username?: string;
        };
      };
    } | null;
    return (
      session?.user?.user_metadata?.user_name ||
      session?.user?.user_metadata?.preferred_username ||
      'User'
    );
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

  signIn(): Observable<void> {
    return from(
      this.supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin,
        },
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
