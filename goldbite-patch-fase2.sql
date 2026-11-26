-- =====================================================================
-- GOLDBITE - Tambahan skema untuk Fase 2
-- Jalankan di Supabase > SQL Editor SETELAH goldbite-schema.sql
-- =====================================================================

-- Cek ketersediaan username SEBELUM mendaftar (boleh dipanggil tanpa login).
-- Hanya mengembalikan true/false, tidak membocorkan data pengguna.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (select 1 from profiles where lower(username) = lower(p_username));
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
