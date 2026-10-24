import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env';

/**
 * True when this page load came from an invite or password-reset email. Read before
 * the client below parses (and clears) the session details from the address bar.
 */
export const openedFromPasswordLink =
  typeof window !== 'undefined' && /(?:^|[#&])type=(?:invite|recovery)(?:&|$)/.test(window.location.hash);

/**
 * Browser Supabase client. Uses only the public anon/publishable key; every
 * request is authorised by Row Level Security in the database
 * (see supabase/migrations). Never create a service-role client in browser code.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
