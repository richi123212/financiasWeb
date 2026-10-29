import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ppocqqzmobdyuxvfcgjm.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_wcdTQChb6teoFhOrTXApDA_B5B90kQf';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('tu-proyecto') &&
  supabaseAnonKey !== 'tu-llave-anon-publica-aqui'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Offline access only restores the user already signed in on this device.
// Server permissions remain governed by Supabase Auth and RLS when reconnecting.
export function readOfflineUser(): UserProfile | null {
  try {
    const key = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(key) || 'null');
    if (!session?.access_token || !session.user?.id) return null;
    return { id: session.user.id, email: session.user.email || '', nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] };
  } catch { return null; }
}
