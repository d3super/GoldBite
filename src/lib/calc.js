// =====================================================================
// GOLDBITE - Calculation Engine
// SATU-SATUNYA tempat rumus perhitungan. Semua layar memanggil modul ini.
// Fungsi murni (tanpa efek samping) agar mudah dites dan diperiksa.
// =====================================================================

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const DEFAULT_SETTINGS = {
  jewelry_buyback_factor: 0.85, // potongan 15% untuk estimasi buyback perhiasan
  bullion_buyback_factor: 0.95, // estimasi buyback batangan bila harga buyback tidak ada
  zakat_nisab_grams: 85,
  zakat_rate: 0.025,
};

// ---- Berat -----------------------------------------------------------
// Berat bersih perhiasan = berat bruto - berat batu/non-emas
export function netWeight(gross, stone = 0) {
  return Math.max(0, num(gross) - num(stone));
}

// A. Berat Emas Murni = Berat Bersih x Kadar
export function pureWeight(net, fineness) {
  return num(net) * num(fineness);
}

// ---- Nilai -----------------------------------------------------------
// B. Nilai Emas = Berat Bersih x Harga 24K x Kadar
export function marketValue(net, price24k, fineness) {
  return r2(num(net) * num(price24k) * num(fineness));
}

// Biaya perolehan = harga beli + biaya tambahan
export function acquisitionCost(purchasePrice, extraCost = 0) {
  return r2(num(purchasePrice) + num(extraCost));
}

// C. Estimasi nilai buyback / likuidasi.
// Urutan prioritas harga (hasil SELALU berlabel basis & isEstimate):
//  1) harga buyback khusus kadar/kategori -> Berat Bersih x Harga Buyback
//  2) harga buyback 24K                   -> Berat x Harga x Kadar (x faktor perhiasan)
//  3) hanya harga pasar 24K               -> Nilai pasar x faktor (perhiasan / batangan)
// Hasil nomor 2 dan 3 adalah ESTIMASI, bukan penawaran resmi toko.
export function liquidationValue(asset, prices = {}, settings = DEFAULT_SETTINGS) {
  const net = num(asset.net_weight);
  const f = num(asset.fineness);
  const isJewelry = asset.category === 'perhiasan';
  const jf = num(settings.jewelry_buyback_factor ?? DEFAULT_SETTINGS.jewelry_buyback_factor);
  const bf = num(settings.bullion_buyback_factor ?? DEFAULT_SETTINGS.bullion_buyback_factor);

  const specific = prices.buybackByPurity?.[asset.purity_code];
  if (num(specific) > 0) {
    return { value: r2(net * num(specific)), basis: 'buyback_kadar', isEstimate: false };
  }
  if (num(prices.buyback24k) > 0) {
    const base = net * num(prices.buyback24k) * f;
    return {
      value: r2(isJewelry ? base * jf : base),
      basis: 'estimasi_buyback_24k',
      isEstimate: true,
    };
  }
  if (num(prices.market24k) > 0) {
    const base = net * num(prices.market24k) * f;
    return {
      value: r2(base * (isJewelry ? jf : bf)),
      basis: 'estimasi_faktor_pasar',
      isEstimate: true,
    };
  }
  return { value: null, basis: 'tidak_ada_harga', isEstimate: true };
}

// Tiga nilai satu aset: akuisisi, pasar, likuidasi
export function valueAsset(asset, prices = {}, settings = DEFAULT_SETTINGS) {
  const acquisition = acquisitionCost(asset.purchase_price, asset.extra_cost);
  const market = num(prices.market24k) > 0
    ? marketValue(asset.net_weight, prices.market24k, asset.fineness)
    : null;
  const liq = liquidationValue(asset, prices, settings);
  return {
    pureGrams: pureWeight(asset.net_weight, asset.fineness),
    acquisition,
    market,
    liquidation: liq.value,
    liquidationBasis: liq.basis,
    liquidationIsEstimate: liq.isEstimate,
    // D. Unrealized P/L = Estimasi Nilai Likuidasi - Biaya Perolehan Tersisa
    unrealizedPL: liq.value == null ? null : unrealizedPL(liq.value, acquisition),
  };
}

// D. Unrealized P/L
export function unrealizedPL(liquidation, remainingCost) {
  return r2(num(liquidation) - num(remainingCost));
}

// E. ROI = (Untung atau Rugi / Modal) x 100%
export function roi(profitLoss, capital) {
  const c = num(capital);
  if (c <= 0) return 0;
  return r2((num(profitLoss) / c) * 100);
}

// Rata-rata harga perolehan per gram emas murni
export function avgPricePerPureGram(totalCost, totalPureGrams) {
  const g = num(totalPureGrams);
  return g > 0 ? r2(num(totalCost) / g) : 0;
}

// ---- Ringkasan portofolio (hanya aset aktif) ---------------------------
export function summarizePortfolio(assets, prices = {}, settings = DEFAULT_SETTINGS) {
  const active = assets.filter((a) => a.status !== 'sold' && !a.deleted_at);
  let capital = 0, market = 0, liquidation = 0, grams = 0, pure = 0;
  let marketComplete = true, liqComplete = true, anyEstimate = false;
  const gramsByCategory = { logam_mulia: 0, perhiasan: 0 };

  for (const a of active) {
    const v = valueAsset(a, prices, settings);
    capital += v.acquisition;
    grams += num(a.net_weight);
    pure += v.pureGrams;
    gramsByCategory[a.category] = (gramsByCategory[a.category] || 0) + num(a.net_weight);
    if (v.market == null) marketComplete = false; else market += v.market;
    if (v.liquidation == null) liqComplete = false; else liquidation += v.liquidation;
    if (v.liquidationIsEstimate) anyEstimate = true;
  }
  const pl = liquidation - capital;
  return {
    itemCount: active.length,
    totalGrams: grams,
    totalPureGrams: pure,
    capital: r2(capital),
    marketValue: r2(market),
    liquidationValue: r2(liquidation),
    unrealizedPL: r2(pl),
    roiPercent: roi(pl, capital),
    avgPricePerPureGram: avgPricePerPureGram(capital, pure),
    gramsByCategory,
    isComplete: marketComplete && liqComplete, // false bila ada aset tanpa harga
    liquidationIsEstimate: anyEstimate,
  };
}

// ---- Realized P/L dengan Weighted Average Cost (WAC) -------------------
// F. Realized P/L = Hasil Penjualan Bersih - Harga Pokok Aset yang Dijual
// Transaksi: { type:'beli'|'jual', trx_date, weight_g, total, extra_cost, tax }
// Beli : modal bertambah (total + biaya tambahan + pajak)
// Jual : hasil bersih = total - biaya tambahan - pajak; HPP = rata-rata x gram terjual
export function realizedPL(transactions) {
  const sorted = transactions
    .filter((t) => !t.deleted_at)
    .sort((a, b) => String(a.trx_date).localeCompare(String(b.trx_date))
      || (a.type === 'beli' ? -1 : 1)); // pada tanggal sama, beli diproses dulu

  let grams = 0, cost = 0, realized = 0, proceedsTotal = 0, cogsTotal = 0;
  const warnings = [];
  const lines = [];

  for (const t of sorted) {
    const w = num(t.weight_g);
    if (t.type === 'beli') {
      grams += w;
      cost += num(t.total) + num(t.extra_cost) + num(t.tax);
    } else {
      if (w > grams + 1e-9) warnings.push(`Penjualan ${t.trx_date} melebihi stok (${w} g > ${r2(grams)} g)`);
      const sellW = Math.min(w, grams);
      const avg = grams > 0 ? cost / grams : 0;
      const cogs = avg * sellW;
      const proceeds = num(t.total) - num(t.extra_cost) - num(t.tax);
      const pl = proceeds - cogs;
      realized += pl; proceedsTotal += proceeds; cogsTotal += cogs;
      grams -= sellW; cost -= cogs;
      lines.push({ trx_date: t.trx_date, weight_g: w, proceeds: r2(proceeds), cogs: r2(cogs), pl: r2(pl) });
    }
  }
  return {
    realizedPL: r2(realized),
    proceeds: r2(proceedsTotal),
    cogs: r2(cogsTotal),
    remainingGrams: Math.max(0, grams),
    remainingCost: r2(Math.max(0, cost)),
    lines,
    warnings,
  };
}

// ---- Zakat mal emas ---------------------------------------------------
// G. Nisab = 85 gram emas murni x harga emas murni (24K)
export function zakatNisab(price24k, settings = DEFAULT_SETTINGS) {
  return r2(num(settings.zakat_nisab_grams ?? 85) * num(price24k));
}

// H. Zakat = Basis Zakat x 2,5%. Wajib bila nisab tercapai DAN sudah haul (1 tahun).
export function zakatMal({ totalPureGrams, price24k, haulMet = true, settings = DEFAULT_SETTINGS }) {
  const nisabGrams = num(settings.zakat_nisab_grams ?? 85);
  const rate = num(settings.zakat_rate ?? 0.025);
  const base = r2(num(totalPureGrams) * num(price24k));
  const nisab = zakatNisab(price24k, settings);
  const reachedNisab = num(totalPureGrams) >= nisabGrams;
  const obligated = reachedNisab && !!haulMet;
  return {
    base, nisab, nisabGrams, rate, reachedNisab, haulMet: !!haulMet, obligated,
    zakat: obligated ? r2(base * rate) : 0,
  };
}
