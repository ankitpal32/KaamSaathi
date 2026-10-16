import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Official Supabase Client Singleton for KaamSaathi Frontend.
 * Configured for automatic session persistence and token refresh in localStorage.
 *
 * NOTE ON DATA DURABILITY:
 * Anonymous sessions are stored in browser storage (localStorage). If the user clears
 * their browser storage, resets website data, or switches devices/browsers, the anonymous
 * user identity will be lost and previously logged records cannot be recovered unless
 * the account is subsequently linked to a permanent credential (email/phone).
 */
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'kaamsaathi_supabase_auth',
      },
    })
  : null;

export interface AnonymousSessionResult {
  token: string | null;
  userId: string | null;
  isAnonymous: boolean;
  error: string | null;
}

/**
 * Initializes or restores an anonymous Supabase session on application launch.
 * Guarantees zero friction: no email, password, or signup form required for technicians.
 *
 * If session initialization fails (e.g., anonymous provider disabled on the Supabase project),
 * returns a descriptive error message without falling back to insecure or mock persistence.
 */
export async function initAnonymousSession(): Promise<AnonymousSessionResult> {
  if (!supabase) {
    // If Supabase URL / Anon key are not provided in environment
    const fallbackToken = localStorage.getItem('supabase_auth_token') || null;
    return {
      token: fallbackToken,
      userId: null,
      isAnonymous: false,
      error: fallbackToken ? null : 'Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured in frontend/.env',
    };
  }

  try {
    // 1. Check if an active session already exists in localStorage
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('Error reading existing Supabase session:', sessionError.message);
    }

    if (session && session.access_token) {
      localStorage.setItem('supabase_auth_token', session.access_token);
      return {
        token: session.access_token,
        userId: session.user.id,
        isAnonymous: Boolean(session.user.is_anonymous),
        error: null,
      };
    }

    // 2. No session found: mint a new anonymous session directly via Supabase Auth
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      let friendlyError = error.message;
      if (
        error.message?.toLowerCase().includes('anonymous sign-ins are disabled') ||
        (error as any).code === 'anonymous_provider_disabled'
      ) {
        friendlyError = 'Anonymous sign-ins are currently disabled on your Supabase Cloud project. Please enable "Anonymous Sign-Ins" in your Supabase Dashboard under Authentication -> Providers -> Anonymous.';
      }
      return {
        token: null,
        userId: null,
        isAnonymous: false,
        error: friendlyError,
      };
    }

    if (data.session && data.session.access_token) {
      localStorage.setItem('supabase_auth_token', data.session.access_token);
      return {
        token: data.session.access_token,
        userId: data.session.user.id,
        isAnonymous: Boolean(data.session.user.is_anonymous),
        error: null,
      };
    }

    return {
      token: null,
      userId: null,
      isAnonymous: false,
      error: 'Supabase authentication did not return a session.',
    };
  } catch (err: any) {
    return {
      token: null,
      userId: null,
      isAnonymous: false,
      error: err.message || 'Unexpected error during anonymous authentication.',
    };
  }
}

/**
 * Returns a valid, non-expired Bearer access token for outgoing API requests.
 * Uses cached session or auto-refreshed session from the official Supabase client.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem('supabase_auth_token', session.access_token);
        return session.access_token;
      }
    } catch {
      // Fall through to localStorage
    }
  }
  return localStorage.getItem('supabase_auth_token') || null;
}

// Auto-sync token updates when Supabase refreshes the token in the background
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      localStorage.setItem('supabase_auth_token', session.access_token);
    } else if (event === 'SIGNED_OUT') {
      localStorage.removeItem('supabase_auth_token');
    }
  });
}
