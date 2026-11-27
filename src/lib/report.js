// Laporan investasi PDF (dibuat di perangkat, tanpa server). pdf-lib dimuat hanya saat dibutuhkan.
import { formatRupiah, formatGram, formatDate, formatCompact, formatPercent } from './format.js';
import { RANGES } from './analytics.js';

const A4 = [595.28, 841.89];
const M = 40; // margin
const NAVY = [20 / 255, 43 / 255, 59 / 255];
const GOLD = [214 / 255, 174 / 255, 85 / 255];
const GRAY = [0.42, 0.45, 0.5];
const LIGHT = [0.95, 0.96, 0.97];
const POS = [21 / 255, 155 / 255, 114 / 255];
const NEG = [214 / 255, 91 / 255, 91 / 255];
const TEXT = [37 / 255, 43 / 255, 51 / 255];

export const reportFilename = (now = new Date()) => {
  const p = (x) => String(x).padStart(2, '0');
  return `goldbite-laporan-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.pdf`;
};

const jakartaStamp = (d) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(d);

export async function buildReportPdf(data) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle('Laporan Investasi Emas - GOLDBITE');
  doc.setAuthor('GOLDBITE');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const col = (c) => rgb(c[0], c[1], c[2]);

  // Huruf yang tidak didukung font standar PDF diganti agar tidak error
  const safe = (v) => String(v ?? '').replace(/\u2212/g, '-').replace(/[\r\n\t]+/g, ' ')
    .split('').map((ch) => (supported.has(ch.codePointAt(0)) ? ch : '?')).join('');

  let page = null;
  let y = 0;
  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - M;
    if (doc.getPageCount() > 1) {
      page.drawText('GOLDBITE  |  Laporan Investasi Emas', { x: M, y: A4[1] - 24, size: 8, font, color: col(GRAY) });
      y = A4[1] - 44;
    }
  };
  const ensure = (h) => { if (!page || y - h < M + 24) newPage(); };

  const width = (s, size, f = font) => f.widthOfTextAtSize(s, size);
  const fit = (s, w, size, f = font) => {
    let t = safe(s);
    if (width(t, size, f) <= w) return t;
    while (t.length > 1 && width(`${t}...`, size, f) > w) t = t.slice(0, -1);
    return `${t}...`;
  };
  const wrap = (s, w, size, f = font) => {
    const words = safe(s).split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (width(test, size, f) <= w || !cur) cur = test; else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };
  const draw = (s, x, yy, { size = 9, f = font, color = TEXT, align = 'left', w = 0 } = {}) => {
    const t = safe(s);
    const xx = align === 'right' ? x + w - width(t, size, f) : align === 'center' ? x + (w - width(t, size, f)) / 2 : x;
    page.drawText(t, { x: xx, y: yy, size, font: f, color: col(color) });
  };

  const heading = (t) => {
    ensure(76); // judul tidak boleh terpisah dari isinya di akhir halaman
    y -= 8;
    draw(t, M, y, { size: 12, f: bold, color: NAVY });
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 1.2, color: col(GOLD) });
    y -= 14;
  };
  const para = (t, { size = 8.5, color = GRAY, indent = 0 } = {}) => {
    for (const line of wrap(t, A4[0] - 2 * M - indent, size)) {
      ensure(size + 5);
      draw(line, M + indent, y, { size, color });
      y -= size + 3.5;
    }
  };

  // Tabel dengan baris judul berulang di tiap halaman
  const table = (cols, rows, { size = 8 } = {}) => {
    const total = cols.reduce((s, c) => s + c.w, 0);
    const scale = (A4[0] - 2 * M) / total;
    const cw = cols.map((c) => c.w * scale);
    const rowH = size + 8;
    const header = () => {
      ensure(rowH * 2);
      page.drawRectangle({ x: M, y: y - rowH + 5, width: A4[0] - 2 * M, height: rowH, color: col(NAVY) });
      let x = M;
      cols.forEach((c, i) => {
        draw(c.label, x + 4, y - rowH + 5 + 4.5, { size, f: bold, color: [1, 1, 1], align: c.align || 'left', w: cw[i] - 8 });
        x += cw[i];
      });
      y -= rowH;
    };
    header();
    rows.forEach((r, ri) => {
      if (y - rowH < M + 24) { newPage(); header(); }
      if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - rowH + 5, width: A4[0] - 2 * M, height: rowH, color: col(LIGHT) });
      let x = M;
      cols.forEach((c, i) => {
        const cell = r[i];
        const val = typeof cell === 'object' && cell !== null ? cell.t : cell;
        const color = typeof cell === 'object' && cell !== null && cell.c ? cell.c : TEXT;
        draw(fit(val, cw[i] - 8, size), x + 4, y - rowH + 5 + 4.5, { size, color, align: c.align || 'left', w: cw[i] - 8 });
        x += cw[i];
      });
      y -= rowH;
    });
    y -= 6;
  };

  const plColor = (n) => (n == null ? TEXT : n >= 0 ? POS : NEG);
  const money = (n) => (n == null ? 'Belum ada harga' : formatRupiah(n));
  const s = data.summary;
  const noPrice = s.itemCount > 0 && !data.priceInputs.market24k;
  const rangeLabel = RANGES.find(([k]) => k === data.range)?.[1] ?? 'Semua';

  // ---- Sampul ringkas ----
  newPage();
  page.drawRectangle({ x: 0, y: A4[1] - 92, width: A4[0], height: 92, color: col(NAVY) });
  draw('GOLDBITE', M, A4[1] - 44, { size: 22, f: bold, color: [1, 1, 1] });
  draw('Laporan Investasi Emas', M, A4[1] - 64, { size: 12, color: [242 / 255, 213 / 255, 138 / 255] });
  draw('Track Your Gold, Grow Your Wealth.', M, A4[1] - 80, { size: 8, color: [0.8, 0.84, 0.88] });
  y = A4[1] - 116;
  draw(`Pemilik: ${data.owner}${data.username ? ` (@${data.username})` : ''}`, M, y, { size: 9.5, f: bold });
  y -= 14;
  draw(`Dicetak: ${jakartaStamp(data.generatedAt)} WIB   |   Periode grafik & transaksi: ${rangeLabel}`, M, y, { size: 8.5, color: GRAY });
  y -= 10;

  // ---- Ringkasan ----
  heading('Ringkasan investasi');
  const kv = [
    ['Total modal (biaya perolehan)', formatRupiah(s.capital)],
    ['Nilai pasar', noPrice ? 'Belum ada harga' : formatRupiah(s.marketValue)],
    ['Estimasi nilai jual kembali', noPrice ? 'Belum ada harga' : formatRupiah(s.liquidationValue)],
    ['Untung/rugi belum terealisasi', noPrice ? '-' : { t: formatRupiah(s.unrealizedPL), c: plColor(s.unrealizedPL) }],
    ['Untung/rugi terealisasi', { t: formatRupiah(data.realized.realizedPL), c: plColor(data.realized.realizedPL) }],
    ['Total untung/rugi', noPrice ? '-' : { t: formatRupiah(data.totalPL), c: plColor(data.totalPL) }],
    ['Return (belum terealisasi / modal)', noPrice ? '-' : { t: formatPercent(s.roiPercent), c: plColor(s.roiPercent) }],
    ['Jumlah item aktif', String(s.itemCount)],
    ['Total berat bersih', formatGram(s.totalGrams)],
    ['Total berat emas murni', formatGram(s.totalPureGrams)],
    ['Harga rata-rata per gram emas murni', s.totalPureGrams > 0 ? formatRupiah(s.avgPricePerPureGram) : '-'],
  ];
  const half = (A4[0] - 2 * M) / 2;
  for (let i = 0; i < kv.length; i += 2) {
    ensure(18);
    [kv[i], kv[i + 1]].forEach((item, j) => {
      if (!item) return;
      const x = M + j * half;
      draw(item[0], x, y, { size: 8, color: GRAY });
      const v = item[1];
      draw(typeof v === 'object' ? v.t : v, x, y - 11, { size: 10.5, f: bold, color: typeof v === 'object' ? v.c : TEXT });
    });
    y -= 30;
  }
  const pi = data.priceInputs;
  if (pi.market24kRow) {
    para(`Harga acuan nilai pasar: ${pi.market24kBasis === 'spot' ? 'harga emas dunia (spot)' : 'harga batangan (retail)'} ${formatRupiah(pi.market24k)} per gram 24K, berlaku ${formatDate(pi.market24kRow.effective_at)}.`);
  }
  if (s.liquidationIsEstimate && s.itemCount > 0) para('Estimasi nilai jual kembali dihitung dari harga buyback atau faktor penyesuaian yang dapat diatur. Angka ini estimasi, bukan penawaran resmi toko.');

  // ---- Grafik perkembangan ----
  heading('Perkembangan portofolio');
  ensure(190);
  const cx = M + 44, cy = y - 150, cwid = A4[0] - 2 * M - 52, chei = 140;
  const pts = data.series;
  const vals = pts.flatMap((p) => [p.capital, p.market]).filter((v) => v != null);
  if (pts.length >= 2 && vals.length) {
    const max = Math.max(...vals) * 1.08 || 1;
    const min = Math.min(0, Math.min(...vals));
    const sx = (i) => cx + (i / (pts.length - 1)) * cwid;
    const sy = (v) => cy + ((v - min) / (max - min)) * chei;
    for (let g = 0; g <= 4; g++) {
      const gy = cy + (g / 4) * chei;
      page.drawLine({ start: { x: cx, y: gy }, end: { x: cx + cwid, y: gy }, thickness: 0.4, color: col([0.85, 0.87, 0.9]) });
      draw(formatCompact(min + (g / 4) * (max - min)), M, gy - 3, { size: 7, color: GRAY, align: 'right', w: 40 });
    }
    const line = (key, color, th) => {
      let prev = null;
      pts.forEach((p, i) => {
        if (p[key] == null) { prev = null; return; }
        const cur = { x: sx(i), y: sy(p[key]) };
        if (prev) page.drawLine({ start: prev, end: cur, thickness: th, color: col(color) });
        else page.drawCircle({ x: cur.x, y: cur.y, size: 1.8, color: col(color) });
        prev = cur;
      });
    };
    line('capital', NAVY, 1.6);
    line('market', GOLD, 2);
    draw(formatDate(pts[0].date), cx, cy - 12, { size: 7, color: GRAY });
    draw(formatDate(pts[pts.length - 1].date), cx, cy - 12, { size: 7, color: GRAY, align: 'right', w: cwid });
    page.drawLine({ start: { x: cx, y: cy - 22 }, end: { x: cx + 14, y: cy - 22 }, thickness: 1.6, color: col(NAVY) });
    draw('Modal', cx + 18, cy - 25, { size: 7.5 });
    page.drawLine({ start: { x: cx + 70, y: cy - 22 }, end: { x: cx + 84, y: cy - 22 }, thickness: 2, color: col(GOLD) });
    draw('Nilai pasar', cx + 88, cy - 25, { size: 7.5 });
    y = cy - 36;
  } else {
    draw('Data belum cukup untuk menampilkan grafik pada periode ini.', M, y - 20, { size: 9, color: GRAY });
    y -= 40;
  }
  para('Nilai pasar pada tiap tanggal memakai harga terakhir yang tercatat pada atau sebelum tanggal itu. Makin sering harga diperbarui, makin akurat grafiknya.');

  // ---- Komposisi ----
  heading('Komposisi kepemilikan (berat bersih)');
  const total = s.totalGrams || 0;
  const share = (g) => (total > 0 ? `${((g / total) * 100).toFixed(1).replace('.', ',')}%` : '-');
  const comp = [
    ...data.byCategory.map((c) => ['Jenis', c.name, formatGram(c.grams), share(c.grams)]),
    ...data.byPurity.map((c) => ['Kadar', c.name, formatGram(c.grams), share(c.grams)]),
  ];
  if (comp.length) table([{ label: 'Dasar', w: 1 }, { label: 'Kelompok', w: 2 }, { label: 'Berat bersih', w: 2, align: 'right' }, { label: 'Porsi', w: 1, align: 'right' }], comp);
  else para('Belum ada aset aktif.');

  // ---- Kepemilikan ----
  heading('Kepemilikan aktif');
  if (data.holdings.length) {
    table(
      [{ label: 'Aset', w: 4 }, { label: 'Kadar', w: 1.1 }, { label: 'Berat', w: 1.6, align: 'right' }, { label: 'Tgl beli', w: 2, align: 'center' },
        { label: 'Modal', w: 2.2, align: 'right' }, { label: 'Est. jual', w: 2.2, align: 'right' }, { label: 'Untung/rugi', w: 2.2, align: 'right' }],
      data.holdings.map(({ a, v }) => [
        a.name, a.purity_code, formatGram(a.net_weight), formatDate(a.purchase_date), formatRupiah(v.acquisition),
        v.liquidation == null ? '-' : formatRupiah(v.liquidation),
        v.unrealizedPL == null ? '-' : { t: formatRupiah(v.unrealizedPL), c: plColor(v.unrealizedPL) },
      ]),
    );
  } else para('Belum ada aset aktif.');

  // ---- Transaksi ----
  heading('Riwayat transaksi');
  if (data.transactions.length) {
    table(
      [{ label: 'Tanggal', w: 2 }, { label: 'Jenis', w: 1.5 }, { label: 'Aset', w: 4 }, { label: 'Berat', w: 1.6, align: 'right' }, { label: 'Total', w: 2.4, align: 'right' }],
      data.transactions.map((t) => [formatDate(t.trx_date), t.type === 'beli' ? 'Pembelian' : 'Penjualan', t.assetName, formatGram(t.weight_g), formatRupiah(t.total)]),
    );
  } else para('Tidak ada transaksi pada periode ini.');

  // ---- Laba terealisasi ----
  heading('Penjualan dan laba terealisasi');
  if (data.realized.lines.length) {
    table(
      [{ label: 'Tanggal', w: 2 }, { label: 'Aset', w: 4 }, { label: 'Hasil bersih', w: 2.4, align: 'right' }, { label: 'Harga pokok', w: 2.4, align: 'right' }, { label: 'Laba/rugi', w: 2.4, align: 'right' }],
      data.realized.lines.map((l) => [formatDate(l.trx_date), l.name, formatRupiah(l.proceeds), formatRupiah(l.cogs), { t: formatRupiah(l.pl), c: plColor(l.pl) }]),
    );
    para(`Total laba/rugi terealisasi: ${formatRupiah(data.realized.realizedPL)}`, { size: 9, color: TEXT });
  } else para('Belum ada penjualan.');

  // ---- Metode ----
  heading('Metode perhitungan dan catatan');
  [
    'Berat emas murni = berat bersih x kadar.',
    'Nilai pasar = berat bersih x harga emas 24K x kadar.',
    'Estimasi nilai jual kembali = berat bersih x harga buyback sesuai kadar; bila tidak tersedia, dihitung dari buyback 24K atau harga pasar dengan faktor penyesuaian (estimasi).',
    'Untung/rugi belum terealisasi = estimasi nilai jual kembali - biaya perolehan aset (harga beli + biaya tambahan).',
    'Untung/rugi terealisasi = hasil penjualan bersih (total - biaya - pajak) - biaya perolehan aset yang dijual (identifikasi spesifik per aset).',
    'Return = untung/rugi belum terealisasi / total modal x 100%.',
    'Harga bersumber dari input pengguna dan layanan harga spot; harga dari sumber berbeda tidak dianggap identik.',
    'Laporan ini alat bantu pencatatan pribadi, bukan nasihat keuangan, dan angka estimasi bukan penawaran resmi toko.',
  ].forEach((t) => para(`- ${t}`, { size: 8.5, color: TEXT, indent: 6 }));

  // ---- Nomor halaman ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const t = `Halaman ${i + 1} dari ${pages.length}`;
    p.drawText(t, { x: A4[0] - M - bold.widthOfTextAtSize(t, 8), y: 22, size: 8, font: bold, color: col(GRAY) });
    p.drawText('GOLDBITE', { x: M, y: 22, size: 8, font: bold, color: col(GOLD) });
  });

  return doc.save();
}
