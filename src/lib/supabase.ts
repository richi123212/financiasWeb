import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('tu-proyecto') &&
  supabaseAnonKey !== 'tu-llave-anon-publica-aqui'
);

// Variables seguras para evitar excepciones fatales en tiempo de ejecución
// en caso de que el usuario aún no haya copiado el archivo .env
const resolvedUrl = isSupabaseConfigured ? supabaseUrl : 'https://demo-finanzshield.supabase.co';
const resolvedKey = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo-key';

export const supabase = createClient(resolvedUrl, resolvedKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
