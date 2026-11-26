import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/calc.js';

test('berat emas murni: 10 g kadar 75% = 7,5 g', () => {
  assert.equal(C.pureWeight(10, 0.75), 7.5);
});

test('berat bersih perhiasan = bruto - batu', () => {
  assert.equal(C.netWeight(5.2, 0.2), 5);
  assert.equal(C.netWeight(1, 3), 0); // tidak boleh negatif
});

test('nilai emas berdasarkan kadar', () => {
  // 10 g x 1.500.000 x 0,75 = 11.250.000
  assert.equal(C.marketValue(10, 1_500_000, 0.75), 11_250_000);
});

test('biaya perolehan = harga beli + biaya tambahan', () => {
  assert.equal(C.acquisitionCost(1_000_000, 50_000), 1_050_000);
});

test('likuidasi: harga buyback kadar spesifik -> bukan estimasi', () => {
  const a = { category: 'logam_mulia', net_weight: 10, fineness: 0.9999, purity_code: '24K' };
  const r = C.liquidationValue(a, { buybackByPurity: { '24K': 1_400_000 }, market24k: 1_500_000 });
  assert.equal(r.value, 14_000_000);
  assert.equal(r.isEstimate, false);
});

test('likuidasi perhiasan dari buyback 24K memakai faktor 0,85 dan berlabel estimasi', () => {
  const a = { category: 'perhiasan', net_weight: 10, fineness: 0.75, purity_code: '18K' };
  const r = C.liquidationValue(a, { buyback24k: 1_400_000 });
  assert.equal(r.value, 8_925_000); // 10 x 1.400.000 x 0,75 x 0,85
  assert.equal(r.basis, 'estimasi_buyback_24k');
  assert.equal(r.isEstimate, true);
});

test('likuidasi tanpa harga apa pun -> null (tidak ditebak)', () => {
  const a = { category: 'perhiasan', net_weight: 10, fineness: 0.75 };
  assert.equal(C.liquidationValue(a, {}).value, null);
});

test('unrealized P/L dan ROI', () => {
  assert.equal(C.unrealizedPL(11_000_000, 10_000_000), 1_000_000);
  assert.equal(C.roi(1_000_000, 10_000_000), 10);
  assert.equal(C.roi(500, 0), 0); // modal 0 tidak boleh error
});

test('ringkasan portofolio hanya menghitung aset aktif', () => {
  const assets = [
    { category: 'logam_mulia', net_weight: 10, fineness: 1, purity_code: '24K',
      purchase_price: 14_000_000, extra_cost: 0, status: 'active' },
    { category: 'perhiasan', net_weight: 5, fineness: 0.75, purity_code: '18K',
      purchase_price: 6_000_000, extra_cost: 500_000, status: 'active' },
    { category: 'logam_mulia', net_weight: 99, fineness: 1, purity_code: '24K',
      purchase_price: 1, status: 'sold' },
  ];
  const s = C.summarizePortfolio(assets, { market24k: 1_500_000, buyback24k: 1_400_000 });
  assert.equal(s.itemCount, 2);
  assert.equal(s.capital, 20_500_000);
  assert.equal(s.totalGrams, 15);
  assert.equal(s.isComplete, true);
  assert.equal(s.liquidationIsEstimate, true);
});

test('WAC: beli 10 g @10jt lalu 10 g @12jt, jual 5 g @13jt', () => {
  const trx = [
    { type: 'beli', trx_date: '2026-01-01', weight_g: 10, total: 10_000_000 },
    { type: 'beli', trx_date: '2026-02-01', weight_g: 10, total: 12_000_000 },
    { type: 'jual', trx_date: '2026-03-01', weight_g: 5, total: 13_000_000 },
  ];
  const r = C.realizedPL(trx);
  // rata-rata = 22jt/20g = 1,1jt/g -> HPP 5 g = 5,5jt ; laba = 13jt - 5,5jt
  assert.equal(r.cogs, 5_500_000);
  assert.equal(r.realizedPL, 7_500_000);
  assert.equal(r.remainingGrams, 15);
  assert.equal(r.remainingCost, 16_500_000);
});

test('WAC: biaya & pajak penjualan mengurangi hasil bersih', () => {
  const trx = [
    { type: 'beli', trx_date: '2026-01-01', weight_g: 10, total: 10_000_000 },
    { type: 'jual', trx_date: '2026-01-02', weight_g: 10, total: 11_000_000, extra_cost: 100_000, tax: 50_000 },
  ];
  assert.equal(C.realizedPL(trx).realizedPL, 850_000);
});

test('WAC: penjualan melebihi stok menghasilkan peringatan', () => {
  const trx = [
    { type: 'beli', trx_date: '2026-01-01', weight_g: 1, total: 1_000_000 },
    { type: 'jual', trx_date: '2026-01-02', weight_g: 2, total: 2_000_000 },
  ];
  assert.equal(C.realizedPL(trx).warnings.length, 1);
});

test('WAC: transaksi yang sudah dihapus (tombstone) diabaikan', () => {
  const trx = [
    { type: 'beli', trx_date: '2026-01-01', weight_g: 1, total: 1_000_000 },
    { type: 'beli', trx_date: '2026-01-02', weight_g: 5, total: 9_000_000, deleted_at: '2026-01-03' },
  ];
  assert.equal(C.realizedPL(trx).remainingGrams, 1);
});

test('zakat: nisab 85 g, tarif 2,5%, wajib bila nisab tercapai dan haul', () => {
  assert.equal(C.zakatNisab(1_500_000), 127_500_000);
  const z = C.zakatMal({ totalPureGrams: 100, price24k: 1_500_000, haulMet: true });
  assert.equal(z.base, 150_000_000);
  assert.equal(z.zakat, 3_750_000);
  assert.equal(z.obligated, true);
});

test('zakat: belum nisab atau belum haul -> 0', () => {
  assert.equal(C.zakatMal({ totalPureGrams: 50, price24k: 1_500_000 }).zakat, 0);
  assert.equal(C.zakatMal({ totalPureGrams: 100, price24k: 1_500_000, haulMet: false }).zakat, 0);
});
