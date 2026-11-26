import { PURITIES } from './constants.js';

const TROY_OZ_GRAM = 31.1034768;

// Harga emas dunia (USD per troy ounce) -> Rupiah per gram emas 24K
export const spotPerGramIDR = (usdPerOz, usdIdr) => Math.round((Number(usdPerOz) * Number(usdIdr)) / TROY_OZ_GRAM);

const ts = (r) => Date.parse(r.effective_at) || 0;

// Harga terbaru per kunci (mis. per merk atau per kadar) untuk satu jenis harga
export function latestPerKey(rows, type, keyFn = () => 'all') {
  const best = new Map();
  for (const r of rows) {
    if (r.price_type !== type) continue;
    const k = keyFn(r);
    if (!best.has(k) || ts(r) > ts(best.get(k))) best.set(k, r);
  }
  return best;
}

// Menyusun masukan harga untuk Calculation Engine.
// Aturan (sengaja sederhana & transparan, sumber ikut ditampilkan):
//  - market24k   : harga retail batangan terbaru; bila belum ada, harga spot terbaru
//  - buyback24k  : harga buyback batangan terbaru
//  - buybackByPurity : harga buyback perhiasan terbaru untuk tiap kadar
export function buildPriceInputs(rows, purities = PURITIES) {
  const codeOf = (id) => purities.find((p) => p.id === id)?.code;
  const retail = latestPerKey(rows, 'retail_batangan').get('all');
  const spot = latestPerKey(rows, 'spot').get('all');
  const buyback = latestPerKey(rows, 'buyback_batangan').get('all');
  const jewelryBuyback = latestPerKey(rows, 'buyback_perhiasan', (r) => r.purity_id);

  const buybackByPurity = {};
  for (const [pid, r] of jewelryBuyback) {
    const code = codeOf(pid);
    if (code) buybackByPurity[code] = Number(r.price_per_gram);
  }
  const market = retail || spot || null;
  return {
    market24k: market ? Number(market.price_per_gram) : 0,
    market24kRow: market,
    market24kBasis: retail ? 'retail_batangan' : spot ? 'spot' : null,
    buyback24k: buyback ? Number(buyback.price_per_gram) : 0,
    buyback24kRow: buyback || null,
    buybackByPurity,
  };
}

// Ambil harga spot otomatis (tanpa API key). fetchFn dapat diganti saat tes.
export async function fetchSpotIDR(fetchFn = (...a) => fetch(...a)) {
  const [g, fx] = await Promise.all([
    fetchFn('https://api.gold-api.com/price/XAU'),
    fetchFn('https://open.er-api.com/v6/latest/USD'),
  ]);
  if (!g.ok || !fx.ok) throw new Error('Layanan harga tidak merespons');
  const gj = await g.json();
  const fj = await fx.json();
  const usdPerOz = Number(gj?.price);
  const usdIdr = Number(fj?.rates?.IDR);
  if (!(usdPerOz > 0) || !(usdIdr > 0)) throw new Error('Data harga tidak valid');
  return {
    usdPerOz, usdIdr,
    perGram: spotPerGramIDR(usdPerOz, usdIdr),
    updatedAt: gj.updatedAt || new Date().toISOString(),
  };
}
