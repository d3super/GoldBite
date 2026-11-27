import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as db from '../src/lib/db.js';
import * as repo from '../src/lib/repo.js';
import * as sync from '../src/lib/sync.js';
import { realizedPLByAsset, summarizePortfolio, DEFAULT_SETTINGS } from '../src/lib/calc.js';
import {
  portfolioSeries, groupPerformance, composition, evaluateAlerts, haulPureGrams, rangeStart, buildReportData,
} from '../src/lib/analytics.js';
import { buildPriceInputs } from '../src/lib/prices.js';
import { buildReportPdf, reportFilename } from '../src/lib/report.js';
import { PURITIES, BRANDS } from '../src/lib/constants.js';
import { formatCompact } from '../src/lib/format.js';
import { makeServer } from './helpers/fakeClient.js';

const enrich = (a) => {
  const p = PURITIES.find((x) => x.id === a.purity_id);
  return { ...a, fineness: p.fineness, purity_code: p.code };
};
const mkAsset = (o) => enrich({
  id: o.id, category: 'logam_mulia', name: o.name || o.id, brand_id: 1, purity_id: 1, net_weight: 10, purchase_price: 14_000_000,
  extra_cost: 0, purchase_date: '2026-09-01', status: 'active', ...o,
});
const price = (type, v, at, extra = {}) => ({ id: `${type}-${at}`, price_type: type, price_per_gram: v, effective_at: at, source_id: 2, brand_id: null, purity_id: 1, ...extra });

beforeEach(() => db.resetMemoryForTests());

test('laba terealisasi per aset = hasil bersih - biaya perolehan aset itu sendiri', () => {
  const a = mkAsset({ id: 'a', purchase_price: 14_000_000, extra_cost: 50_000, status: 'sold' });
  const b = mkAsset({ id: 'b', net_weight: 5, purchase_price: 6_000_000 });
  const trx = [
    { type: 'jual', asset_id: 'a', trx_date: '2026-11-01', total: 16_000_000, extra_cost: 0, tax: 0 },
    { type: 'jual', asset_id: 'a', trx_date: '2026-11-02', total: 1, deleted_at: 'x' },
    { type: 'beli', asset_id: 'b', trx_date: '2026-09-01', total: 6_000_000 },
  ];
  const r = realizedPLByAsset([a, b], trx);
  assert.equal(r.realizedPL, 1_950_000);
  assert.equal(r.soldCount, 1);
});

test('realized + unrealized konsisten: total modal tersisa hanya dari aset aktif', () => {
  const a = mkAsset({ id: 'a', status: 'sold' });
  const b = mkAsset({ id: 'b', net_weight: 5, purchase_price: 6_000_000, purity_id: 5 });
  const inputs = { market24k: 1_500_000, buyback24k: 1_400_000 };
  const s = summarizePortfolio([a, b], inputs, DEFAULT_SETTINGS);
  assert.equal(s.capital, 6_000_000); // hanya aset b
  assert.equal(s.itemCount, 1);
});

test('rangeStart: YTD, 1B, ALL', () => {
  const now = new Date(2026, 10, 26, 12);
  assert.equal(rangeStart('YTD', now).getMonth(), 0);
  assert.equal(rangeStart('YTD', now).getDate(), 1);
  assert.equal(rangeStart('1B', now).getMonth(), 9);
  assert.equal(rangeStart('ALL', now), null);
});

test('seri portofolio: modal bertahap, nilai pasar kosong sebelum ada harga, aset terjual keluar', () => {
  const now = new Date(2026, 10, 26, 12);
  const a = mkAsset({ id: 'a', purchase_date: '2026-09-01' });
  const b = mkAsset({ id: 'b', purchase_date: '2026-10-15', net_weight: 5, purchase_price: 6_000_000, purity_id: 5 });
  const trx = [{ type: 'jual', asset_id: 'a', trx_date: '2026-11-10', total: 16_000_000 }];
  const prices = [price('retail_batangan', 1_500_000, '2026-10-01T12:00:00')];
  const ser = portfolioSeries({ assets: [a, b], transactions: trx, prices, purities: PURITIES }, 'ALL', now);
  const at = (d) => ser.find((p) => p.date === d);
  assert.equal(at('2026-09-01').capital, 14_000_000);
  assert.equal(at('2026-09-01').market, null);
  assert.equal(at('2026-10-01').market, 14_998_500);
  assert.equal(at('2026-10-15').capital, 20_000_000);
  assert.equal(at('2026-11-10').capital, 6_000_000); // a sudah terjual
  const last = ser[ser.length - 1];
  assert.equal(last.date, '2026-11-26');
  // b: 5 g x 1.500.000 x 0,75
  assert.equal(last.market, 5_625_000);
});

test('seri portofolio: filter 1 bulan hanya memuat titik dalam periode dan menyertakan titik awal', () => {
  const now = new Date(2026, 10, 26, 12);
  const a = mkAsset({ id: 'a', purchase_date: '2026-06-01' });
  const prices = [price('spot', 1_500_000, '2026-06-02T12:00:00'), price('spot', 1_600_000, '2026-11-20T12:00:00')];
  const ser = portfolioSeries({ assets: [a], transactions: [], prices, purities: PURITIES }, '1B', now);
  assert.equal(ser[0].date, '2026-10-26');
  assert.ok(ser.every((p) => p.date >= '2026-10-26'));
  assert.equal(ser[0].market, 14_998_500); // harga 1.500.000 masih berlaku pada titik awal
  assert.equal(ser[ser.length - 1].market, 15_998_400);
});

test('kinerja per merk dan komposisi', () => {
  const a = mkAsset({ id: 'a', brand_id: 1 });
  const b = mkAsset({ id: 'b', brand_id: 2, purchase_price: 15_000_000 });
  const j = mkAsset({ id: 'j', category: 'perhiasan', brand_id: null, purity_id: 5, net_weight: 5, purchase_price: 6_000_000 });
  const inputs = { market24k: 1_500_000, buyback24k: 1_400_000 };
  const rows = groupPerformance([a, b, j], inputs, DEFAULT_SETTINGS,
    (x) => ({ key: x.brand_id ?? 'p', label: BRANDS.find((br) => br.id === x.brand_id)?.name ?? 'Perhiasan' }));
  assert.equal(rows.length, 3);
  const antam = rows.find((r) => r.key === 1);
  assert.equal(antam.capital, 14_000_000);
  assert.equal(antam.liquidation, 13_998_600); // 10 x 1.400.000 x 0,9999
  assert.equal(antam.pl, -1_400);
  const none = groupPerformance([a], {}, DEFAULT_SETTINGS, () => ({ key: 'x', label: 'x' }));
  assert.equal(none[0].pl, null); // tanpa harga: tidak menebak

  assert.deepEqual(composition([a, b, j], 'category'), [{ name: 'Logam mulia', grams: 20 }, { name: 'Perhiasan', grams: 5 }]);
  assert.deepEqual(composition([a, j], 'purity').map((x) => x.name), ['24K', '18K']);
});

test('notifikasi: terpicu sesuai arah, abaikan yang nonaktif/terpicu/tanpa harga', () => {
  const ctx = { priceInputs: { market24k: 2_500_000, buyback24k: 2_300_000 }, summary: { itemCount: 1, marketValue: 30_000_000 } };
  const base = { is_active: true, triggered_at: null, deleted_at: null };
  const alerts = [
    { id: '1', alert_type: 'harga_emas', direction: 'di_atas', target_value: 2_500_000, ...base },
    { id: '2', alert_type: 'harga_emas', direction: 'di_atas', target_value: 2_600_000, ...base },
    { id: '3', alert_type: 'buyback', direction: 'di_bawah', target_value: 2_400_000, ...base },
    { id: '4', alert_type: 'nilai_portfolio', direction: 'di_atas', target_value: 25_000_000, ...base },
    { id: '5', alert_type: 'harga_emas', direction: 'di_atas', target_value: 1, ...base, is_active: false },
    { id: '6', alert_type: 'harga_emas', direction: 'di_atas', target_value: 1, ...base, triggered_at: 'x' },
  ];
  assert.deepEqual(evaluateAlerts(alerts, ctx).map((h) => h.alert.id), ['1', '3', '4']);
  const empty = { priceInputs: { market24k: 0, buyback24k: 0 }, summary: { itemCount: 0, marketValue: 0 } };
  assert.equal(evaluateAlerts(alerts, empty).length, 0);
});

test('haul: hanya aset yang dimiliki minimal 354 hari', () => {
  const now = new Date(2026, 10, 26, 12);
  const old = mkAsset({ id: 'o', purchase_date: '2025-10-01', net_weight: 10 });
  const fresh = mkAsset({ id: 'f', purchase_date: '2026-06-01', net_weight: 10 });
  const g = haulPureGrams([old, fresh], now);
  assert.ok(Math.abs(g - 9.999) < 1e-9);
});

test('repo notifikasi: simpan, picu, aktifkan ulang, hapus', async () => {
  const U = 'u1';
  const a = await repo.saveAlert(U, { alert_type: 'harga_emas', direction: 'di_atas', target_value: 2_500_000 });
  assert.equal(a.is_active, true);
  await assert.rejects(() => repo.saveAlert(U, { alert_type: 'harga_emas', direction: 'di_atas', target_value: 0 }), (e) => !!e.fields.target_value);
  await repo.triggerAlert(U, a);
  let [cur] = await repo.listAlerts(U);
  assert.equal(cur.is_active, false);
  assert.ok(cur.triggered_at);
  await repo.setAlertActive(U, cur, true);
  [cur] = await repo.listAlerts(U);
  assert.equal(cur.is_active, true);
  assert.equal(cur.triggered_at, null);
  await repo.deleteAlert(U, cur);
  assert.equal((await repo.listAlerts(U)).length, 0);
});

test('sync notifikasi: terkirim ke server dan tertarik di perangkat baru', async () => {
  const { srv, client } = makeServer();
  const U = 'u1';
  const a = await repo.saveAlert(U, { alert_type: 'buyback', direction: 'di_bawah', target_value: 2_000_000 });
  await repo.triggerAlert(U, a);
  assert.ok((await repo.pendingCount(U)) > 0);
  const s = await sync.runSync(client, U);
  assert.equal(s.error, null);
  assert.equal(srv.tables.price_alerts.length, 1);
  assert.equal(await repo.pendingCount(U), 0);
  db.resetMemoryForTests();
  await sync.runSync(client, U);
  const [got] = await repo.listAlerts(U);
  assert.equal(got.target_value, 2_000_000);
  assert.equal(typeof got.target_value, 'number');
  assert.ok(got.triggered_at);
});

test('format ringkas untuk sumbu grafik', () => {
  assert.equal(formatCompact(20_500_000), '20,5 jt');
  assert.equal(formatCompact(1_200_000_000), '1,2 M');
  assert.equal(formatCompact(750), '750');
});

function sampleCtx() {
  const a = mkAsset({ id: 'a', name: 'Antam 10 g', purchase_date: '2026-09-01', status: 'sold', extra_cost: 50_000 });
  const b = mkAsset({ id: 'b', name: 'Cincin Café ✓ “polos”', category: 'perhiasan', brand_id: null, purity_id: 5, net_weight: 5, purchase_price: 6_000_000, purchase_date: '2026-10-15' });
  const c = mkAsset({ id: 'c', name: 'Galeri24 5 g', brand_id: 4, net_weight: 5, purchase_price: 7_200_000, purchase_date: '2025-08-01' });
  const prices = [
    price('retail_batangan', 1_500_000, '2026-10-01T12:00:00'),
    price('buyback_batangan', 1_400_000, '2026-10-01T12:00:00'),
    price('buyback_perhiasan', 1_000_000, '2026-11-01T12:00:00', { purity_id: 5 }),
  ];
  const trx = [
    { id: 't1', type: 'beli', asset_id: 'a', trx_date: '2026-09-01', weight_g: 10, total: 14_000_000 },
    { id: 't2', type: 'beli', asset_id: 'b', trx_date: '2026-10-15', weight_g: 5, total: 6_000_000 },
    { id: 't3', type: 'jual', asset_id: 'a', trx_date: '2026-11-10', weight_g: 10, total: 16_000_000, extra_cost: 0, tax: 0 },
  ];
  return {
    assets: [a, b, c], transactions: trx, prices, purities: PURITIES, settings: DEFAULT_SETTINGS,
    priceInputs: buildPriceInputs(prices, PURITIES), profile: { full_name: 'Dedi Contoh', username: 'dedi' },
  };
}

test('laporan PDF: terbentuk, valid, dan tahan karakter non-Latin', async () => {
  const data = buildReportData(sampleCtx(), 'ALL', new Date(2026, 10, 26, 8, 30));
  assert.equal(data.realized.realizedPL, 1_950_000);
  const bytes = await buildReportPdf(data);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.ok(bytes.length > 3000);
  writeFileSync('/tmp/goldbite-test-report.pdf', bytes);
  assert.match(reportFilename(new Date(2026, 10, 26)), /^goldbite-laporan-2026-11-26\.pdf$/);
});

test('laporan PDF: portofolio kosong dan tanpa harga tidak error', async () => {
  const ctx = { assets: [], transactions: [], prices: [], purities: PURITIES, settings: DEFAULT_SETTINGS, priceInputs: buildPriceInputs([], PURITIES), profile: null };
  const bytes = await buildReportPdf(buildReportData(ctx, '3B', new Date(2026, 10, 26)));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  const noPrice = sampleCtx();
  noPrice.prices = []; noPrice.priceInputs = buildPriceInputs([], PURITIES);
  const b2 = await buildReportPdf(buildReportData(noPrice, 'ALL', new Date(2026, 10, 26)));
  assert.ok(b2.length > 2000);
});

test('laporan PDF: data banyak menghasilkan banyak halaman', async () => {
  const ctx = sampleCtx();
  const many = [];
  for (let i = 0; i < 80; i++) many.push(mkAsset({ id: `x${i}`, name: `Aset ke-${i + 1}`, purchase_date: '2026-10-02' }));
  ctx.assets = [...ctx.assets, ...many];
  const bytes = await buildReportPdf(buildReportData(ctx, 'ALL', new Date(2026, 10, 26)));
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3);
});
