# GOLDBITE – Fase 4
Track Your Gold, Grow Your Wealth.

- Fase 2: kerangka PWA, tema navy-gold, login/PIN, Calculation Engine
- Fase 3: aset, transaksi, harga emas, penyimpanan lokal + sinkronisasi dasar
- Fase 4: dashboard & grafik, analisis, notifikasi harga, kalkulator zakat, laporan PDF, ekspor data

## Struktur penting
- `src/lib/calc.js`        Calculation Engine (semua rumus)
- `src/lib/analytics.js`   deret waktu portofolio, kinerja per kelompok, notifikasi, zakat, data laporan
- `src/lib/report.js`      pembuat laporan PDF (pdf-lib, dimuat saat dibutuhkan)
- `src/lib/repo.js`, `sync.js`, `db.js`  data local-first dan sinkronisasi
- `src/pages/`             Dashboard (Shell), Portfolio, Prices, Analysis, Zakat, Notifications, Transactions
- `tests/`                 tes otomatis (`npm test`)
- `goldbite-patch-fase3.sql`, `goldbite-patch-fase4.sql`  tambahan SQL (jalankan di Supabase)

## Menjalankan di komputer (opsional)
`.env` diisi seperti `.env.example`, lalu `npm install`, `npm run dev`, `npm test`.
