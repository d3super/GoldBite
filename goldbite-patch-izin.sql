-- =====================================================================
-- GOLDBITE - Izin akses tabel untuk Data API Supabase
-- Project Supabase baru tidak lagi otomatis memberi izin ke tabel baru.
-- Jalankan sebagai query baru di SQL Editor. Aman dijalankan berulang kali.
-- Keamanan data tetap dijaga Row Level Security (RLS): izin di bawah hanya
-- membuka "pintu tabel", sedangkan baris yang boleh dilihat tetap dibatasi RLS.
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- Profil: baca & ubah milik sendiri (dibatasi RLS)
grant select, update on public.profiles to authenticated;

-- Master data: semua user login boleh baca; ubah hanya lolos untuk Super Admin (dibatasi RLS)
grant select, insert, update, delete on
  public.brands, public.purities, public.price_sources, public.system_settings
  to authenticated;

-- Data pribadi
grant select, insert, update, delete on
  public.assets, public.transactions, public.price_alerts, public.sync_log
  to authenticated;

grant select, insert, delete on public.price_history to authenticated;
grant select on public.audit_log to authenticated;

-- Nomor urut otomatis (id) untuk tabel yang memakainya
grant usage, select on all sequences in schema public to authenticated;

-- Fungsi pengecek peran dipakai oleh aturan RLS
grant execute on function public.is_admin() to authenticated;
