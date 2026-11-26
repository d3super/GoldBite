import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// false bila file .env / environment variable di Vercel belum diisi
export const configOk = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost', key || 'belum-diisi', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
