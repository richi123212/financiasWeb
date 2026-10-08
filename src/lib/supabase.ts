import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ppocqqzmobdyuxvfcgjm.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb2Nxc3ptb2JkeXV4dmZjZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjgwODAsImV4cCI6MjA2NDk0NDA4MH0.SM4XLkuh-HJRUGDHwsgrq1_91247TyhsySRduWyKpTg';

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
