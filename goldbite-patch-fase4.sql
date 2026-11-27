-- =====================================================================
-- GOLDBITE - Tambahan skema untuk Fase 4 (notifikasi harga tersinkron)
-- Jalankan sebagai query baru di Supabase > SQL Editor. Aman dijalankan berulang kali.
-- =====================================================================

alter table public.price_alerts add column if not exists updated_at timestamptz not null default now();
alter table public.price_alerts add column if not exists deleted_at timestamptz;

create index if not exists price_alerts_user_idx on public.price_alerts (user_id, updated_at);

drop trigger if exists price_alerts_touch on public.price_alerts;
create trigger price_alerts_touch before update on public.price_alerts
  for each row execute function public.touch_row();
