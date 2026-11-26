-- =====================================================================
-- GOLDBITE - Tambahan skema untuk Fase 3
-- Jalankan sebagai query baru di Supabase > SQL Editor. Aman dijalankan berulang kali.
-- =====================================================================

-- Penanda unik dari perangkat agar harga yang terkirim dua kali tidak menjadi dobel
alter table public.price_history add column if not exists client_id uuid;
create unique index if not exists price_history_client_uidx on public.price_history (client_id);
