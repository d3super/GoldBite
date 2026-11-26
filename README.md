# GOLDBITE – Fase 2
Track Your Gold, Grow Your Wealth.

Isi Fase 2: kerangka PWA, tema navy-gold (terang/gelap), start screen, daftar, login,
PIN, lupa PIN, lupa password, login Super Admin, kerangka menu (bottom navigation),
profil, dan Calculation Engine terpusat beserta 15 tes otomatis.

## Struktur
- `src/lib/calc.js`        Calculation Engine (semua rumus ada di sini)
- `src/lib/pin.js`         PIN lokal (hash PBKDF2, tidak dikirim ke server)
- `src/context/AppContext.jsx`  login, sesi, tema, kunci aplikasi
- `src/pages/`             Auth, Pin, ResetPassword, Shell (menu utama)
- `tests/calc.test.js`     tes perhitungan (`npm test`)
- `goldbite-patch-fase2.sql`    tambahan SQL (jalankan di Supabase)

## Menjalankan di komputer (opsional)
1. Install Node.js 20+.
2. Salin `.env.example` menjadi `.env`, isi URL dan anon key Supabase.
3. `npm install` lalu `npm run dev`.
4. `npm test` untuk menjalankan tes perhitungan.

Panduan lengkap deploy lewat GitHub + Vercel ada di pesan chat.
