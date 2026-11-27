// Perhitungan turunan untuk dashboard, analisis, notifikasi, zakat, dan laporan.
// Rumus dasar tetap berada di calc.js; modul ini hanya menyusun/mengelompokkan datanya.
import { buildPriceInputs } from './prices.js';
import { formatRupiah } from './format.js';
import {
  valueAsset, marketValue, summarizePortfolio, realizedPLByAsset, roi, pureWeight,
} from './calc.js';

const pad = (x) => String(x).padStart(2, '0');
export const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const endOfDay = (s) => Date.parse(`${s}T23:59:59`);

export const RANGES = [['1B', '1 bulan'], ['3B', '3 bulan'], ['6B', '6 bulan'], ['YTD', 'YTD'], ['1T', '1 tahun'], ['ALL', 'Semua']];

export function rangeStart(range, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === '1B') d.setMonth(d.getMonth() - 1);
  else if (range === '3B') d.setMonth(d.getMonth() - 3);
  else if (range === '6B') d.setMonth(d.getMonth() - 6);
  else if (range === '1T') d.setFullYear(d.getFullYear() - 1);
  else if (range === 'YTD') { d.setMonth(0); d.setDate(1); }
  else return null;
  return d;
}

// Perkembangan modal dan nilai pasar dari waktu ke waktu.
// Nilai pasar pada suatu tanggal memakai harga terakhir yang tercatat pada/ sebelum tanggal itu;
// bila belum ada harga, nilai pasar dikosongkan (null) agar tidak menebak.
export function portfolioSeries({ assets, transactions, prices, purities }, range = 'ALL', now = new Date()) {
  const saleDate = new Map();
  for (const t of transactions) if (!t.deleted_at && t.type === 'jual' && t.asset_id) saleDate.set(t.asset_id, String(t.trx_date).slice(0, 10));
  const today = dateStr(now);

  const dates = new Set([today]);
  for (const a of assets) { dates.add(a.purchase_date); if (saleDate.has(a.id)) dates.add(saleDate.get(a.id)); }
  for (const p of prices) { const d = dateStr(new Date(p.effective_at)); if (d <= today) dates.add(d); }
  let list = [...dates].filter((d) => d <= today).sort();
  if (!list.length) return [];

  const start = rangeStart(range, now);
  if (start) {
    const s = dateStr(start);
    list = list.filter((d) => d >= s);
    if (list[0] !== s) list.unshift(s);
  }
  if (list.length > 90) {
    const step = (list.length - 1) / 89;
    list = Array.from({ length: 90 }, (_, i) => list[Math.round(i * step)]);
  }

  return list.map((d) => {
    const held = assets.filter((a) => a.purchase_date <= d && !(saleDate.has(a.id) && saleDate.get(a.id) <= d));
    const cut = endOfDay(d);
    const inputs = buildPriceInputs(prices.filter((p) => Date.parse(p.effective_at) <= cut), purities);
    const capital = held.reduce((s, a) => s + Number(a.purchase_price || 0) + Number(a.extra_cost || 0), 0);
    const market = inputs.market24k > 0 && held.length
      ? held.reduce((s, a) => s + marketValue(a.net_weight, inputs.market24k, a.fineness), 0)
      : (inputs.market24k > 0 ? 0 : null);
    return { date: d, capital: Math.round(capital), market: market == null ? null : Math.round(market) };
  });
}

// Kinerja per kelompok (merk, kadar, jenis, item, periode beli)
export function groupPerformance(activeAssets, priceInputs, settings, keyFn) {
  const map = new Map();
  for (const a of activeAssets) {
    const { key, label } = keyFn(a);
    const v = valueAsset(a, priceInputs, settings);
    const g = map.get(key) || { key, label, count: 0, grams: 0, capital: 0, liquidation: 0, missing: 0 };
    g.count += 1; g.grams += Number(a.net_weight); g.capital += v.acquisition;
    if (v.liquidation == null) g.missing += 1; else g.liquidation += v.liquidation;
    map.set(key, g);
  }
  return [...map.values()].map((g) => {
    const valued = g.missing < g.count;
    const pl = valued ? g.liquidation - g.capital : null;
    return { ...g, pl, roi: valued ? roi(pl, g.capital) : null };
  }).sort((a, b) => b.capital - a.capital);
}

// Komposisi berdasarkan berat bersih (gram)
export function composition(activeAssets, by) {
  const map = new Map();
  for (const a of activeAssets) {
    const k = by === 'purity' ? a.purity_code : a.category === 'perhiasan' ? 'Perhiasan' : 'Logam mulia';
    map.set(k, (map.get(k) || 0) + Number(a.net_weight));
  }
  return [...map.entries()].map(([name, grams]) => ({ name, grams: Math.round(grams * 10000) / 10000 })).sort((a, b) => b.grams - a.grams);
}

// ---- Notifikasi harga ----------------------------------------------------
export const ALERT_TYPES = [
  { id: 'harga_emas', label: 'Harga emas per gram' },
  { id: 'buyback', label: 'Harga buyback per gram' },
  { id: 'nilai_portfolio', label: 'Nilai portofolio' },
];

export function alertCurrent(type, { priceInputs, summary }) {
  if (type === 'harga_emas') return priceInputs.market24k || 0;
  if (type === 'buyback') return priceInputs.buyback24k || 0;
  if (type === 'nilai_portfolio') return summary.itemCount > 0 ? summary.marketValue : 0;
  return 0;
}

// Notifikasi aktif yang syaratnya terpenuhi saat ini. Hanya yang aktif & belum pernah terpicu.
export function evaluateAlerts(alerts, ctx) {
  const hits = [];
  for (const a of alerts) {
    if (a.deleted_at || !a.is_active || a.triggered_at) continue;
    const cur = alertCurrent(a.alert_type, ctx);
    if (!(cur > 0)) continue;
    const ok = a.direction === 'di_atas' ? cur >= Number(a.target_value) : cur <= Number(a.target_value);
    if (ok) hits.push({ alert: a, current: cur });
  }
  return hits;
}

// ---- Zakat ---------------------------------------------------------------
const HAUL_DAYS = 354; // satu tahun hijriah
// Berat emas murni dari aset yang sudah dimiliki minimal satu tahun hijriah
export function haulPureGrams(activeAssets, now = new Date()) {
  const limit = new Date(now); limit.setHours(0, 0, 0, 0); limit.setDate(limit.getDate() - HAUL_DAYS);
  const s = dateStr(limit);
  return activeAssets.filter((a) => a.purchase_date <= s).reduce((t, a) => t + pureWeight(a.net_weight, a.fineness), 0);
}

// ---- Data laporan --------------------------------------------------------
export function buildReportData(ctx, range = 'ALL', now = new Date()) {
  const { assets, transactions, prices, purities, settings, priceInputs, profile } = ctx;
  const active = assets.filter((a) => a.status !== 'sold');
  const summary = summarizePortfolio(assets, priceInputs, settings);
  const realized = realizedPLByAsset(assets, transactions);
  const start = rangeStart(range, now);
  const from = start ? dateStr(start) : null;
  const nameOf = (id) => assets.find((a) => a.id === id)?.name ?? 'Aset';
  const holdings = active.map((a) => ({ a, v: valueAsset(a, priceInputs, settings) }));
  const trx = transactions.filter((t) => !from || String(t.trx_date) >= from)
    .map((t) => ({ ...t, assetName: nameOf(t.asset_id) }));
  return {
    owner: profile?.full_name || '-', username: profile?.username || '', generatedAt: now, range, from,
    summary, realized, totalPL: Math.round((summary.unrealizedPL + realized.realizedPL) * 100) / 100,
    holdings, transactions: trx,
    series: portfolioSeries({ assets, transactions, prices, purities }, range, now),
    byCategory: composition(active, 'category'), byPurity: composition(active, 'purity'),
    priceInputs,
  };
}

export function alertMessage(a, current) {
  const t = ALERT_TYPES.find((x) => x.id === a.alert_type)?.label ?? 'Nilai';
  const dir = a.direction === 'di_atas' ? 'mencapai atau melewati' : 'turun ke atau di bawah';
  return `${t} ${dir} ${formatRupiah(a.target_value)} (sekarang ${formatRupiah(current)})`;
}
