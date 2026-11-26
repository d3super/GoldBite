# GOLDBITE – Fase 3
Track Your Gold, Grow Your Wealth.

Fase 2: kerangka PWA, tema navy-gold, login/PIN, Calculation Engine.
Fase 3: aset (logam mulia & perhiasan), transaksi beli/jual, harga emas, penyimpanan lokal
(IndexedDB) dan sinkronisasi dasar ke Supabase, foto aset & bukti transaksi.

## Struktur penting
- `src/lib/calc.js`     Calculation Engine (semua rumus)
- `src/lib/db.js`       penyimpanan lokal IndexedDB
- `src/lib/repo.js`     operasi data local-first (aset, transaksi, harga, foto)
- `src/lib/sync.js`     kirim/tarik data ke Supabase
- `src/lib/prices.js`   pemilihan harga acuan + ambil harga spot
- `src/context/DataContext.jsx`  data & status sinkronisasi untuk seluruh layar
- `src/pages/`          Portfolio, Transactions, Prices, Shell, Auth, Pin
- `tests/`              30 tes otomatis (`npm test`)
- `goldbite-patch-fase3.sql`  tambahan SQL Fase 3 (jalankan di Supabase)

## Menjalankan di komputer (opsional)
`.env` diisi seperti `.env.example`, lalu `npm install`, `npm run dev`, `npm test`.
