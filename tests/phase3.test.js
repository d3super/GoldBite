import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/lib/db.js';
import * as repo from '../src/lib/repo.js';
import * as sync from '../src/lib/sync.js';
import { realizedPL, summarizePortfolio } from '../src/lib/calc.js';
import { buildPriceInputs, spotPerGramIDR, fetchSpotIDR } from '../src/lib/prices.js';
import { PURITIES } from '../src/lib/constants.js';
import { makeServer } from './helpers/fakeClient.js';

const U = 'u1';
const bullion = {
  category: 'logam_mulia', name: 'Antam 10 g', brand_id: 1, product_type: 'Batangan', purity_id: 1,
  net_weight: 10, purchase_date: '2026-11-01', purchase_price: 14_000_000, extra_cost: 50_000, store: 'Butik',
};
const jewelry = {
  category: 'perhiasan', name: 'Cincin polos', jewelry_type: 'cincin', purity_id: 5,
  gross_weight: 5.2, stone_weight: 0.2, purchase_date: '2026-11-02', purchase_price: 6_000_000, extra_cost: 0,
};

beforeEach(() => {
  db.resetMemoryForTests();
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
});

test('simpan logam mulia: aset + transaksi beli otomatis', async () => {
  const a = await repo.saveAsset(U, bullion);
  assert.equal(a.net_weight, 10);
  assert.equal(a.status, 'active');
  assert.equal(a._pending, true);
  const trx = await repo.listTransactions(U);
  assert.equal(trx.length, 1);
  assert.equal(trx[0].type, 'beli');
  assert.equal(trx[0].total, 14_000_000);
  assert.equal(trx[0].price_per_g, 1_400_000);
  assert.equal(trx[0].weight_g, 10);
});

test('perhiasan: berat bersih = bruto - batu; batu > bruto ditolak', async () => {
  const a = await repo.saveAsset(U, jewelry);
  assert.equal(a.net_weight, 5);
  await assert.rejects(() => repo.saveAsset(U, { ...jewelry, stone_weight: 9 }), (e) => e.message === 'VALIDATION' && !!e.fields.stone_weight);
});

test('validasi: nama, berat, dan harga wajib', async () => {
  await assert.rejects(() => repo.saveAsset(U, { ...bullion, name: ' ', net_weight: 0, purchase_price: 0 }),
    (e) => Boolean(e.fields.name && e.fields.net_weight && e.fields.purchase_price));
});

test('ubah aset memperbarui transaksi beli yang sama (tidak membuat duplikat)', async () => {
  const a = await repo.saveAsset(U, bullion);
  const [t0] = await repo.listTransactions(U);
  const a2 = await repo.saveAsset(U, { ...bullion, purchase_price: 15_000_000 }, a);
  const trx = await repo.listTransactions(U);
  assert.equal(trx.length, 1);
  assert.equal(trx[0].id, t0.id);
  assert.equal(trx[0].total, 15_000_000);
  assert.equal(a2._rev, 2);
});

test('jual aset: status terjual, laba terealisasi (WAC) benar, bisa dibatalkan', async () => {
  const a = await repo.saveAsset(U, bullion);
  await repo.sellAsset(U, a, { trx_date: '2026-12-01', total: 16_000_000, extra_cost: 0, tax: 0 });
  let assets = await repo.listAssets(U);
  assert.equal(assets[0].status, 'sold');
  const trx = await repo.listTransactions(U);
  assert.equal(trx.length, 2);
  // modal 14.000.000 + biaya 50.000 = 14.050.000 ; hasil 16.000.000 -> laba 1.950.000
  assert.equal(realizedPL(trx).realizedPL, 1_950_000);
  await assert.rejects(() => repo.sellAsset(U, assets[0], { trx_date: '2026-12-02', total: 1 }), (e) => !!e.fields.asset);

  const sale = trx.find((t) => t.type === 'jual');
  await repo.cancelSale(U, sale);
  assets = await repo.listAssets(U);
  assert.equal(assets[0].status, 'active');
  assert.equal((await repo.listTransactions(U)).length, 1);
});

test('hapus aset = tombstone untuk aset dan transaksinya', async () => {
  const a = await repo.saveAsset(U, bullion);
  await repo.deleteAsset(U, a);
  assert.equal((await repo.listAssets(U)).length, 0);
  assert.equal((await repo.listTransactions(U)).length, 0);
  const raw = await db.getAll('assets');
  assert.equal(raw.length, 1);
  assert.ok(raw[0].deleted_at);
});

test('data pengguna lain tidak terlihat', async () => {
  await repo.saveAsset('u1', bullion);
  await repo.saveAsset('u2', bullion);
  assert.equal((await repo.listAssets('u1')).length, 1);
  assert.equal((await repo.listAssets('u2')).length, 1);
});

test('ringkasan portofolio dari aset tersimpan memakai Calculation Engine', async () => {
  await repo.saveAsset(U, bullion);
  await repo.saveAsset(U, jewelry);
  const assets = (await repo.listAssets(U)).map((a) => {
    const p = PURITIES.find((x) => x.id === a.purity_id);
    return { ...a, fineness: p.fineness, purity_code: p.code };
  });
  const s = summarizePortfolio(assets, { market24k: 1_500_000, buyback24k: 1_400_000 });
  assert.equal(s.itemCount, 2);
  assert.equal(s.capital, 20_050_000);
  assert.equal(s.totalGrams, 15);
});

test('harga: retail diprioritaskan, spot sebagai cadangan, buyback perhiasan per kadar', async () => {
  const add = (o) => repo.addPrice(U, { source_id: 2, effective_at: '2026-11-26T01:00:00Z', ...o });
  await add({ price_type: 'spot', purity_id: 1, price_per_gram: 1_700_000 });
  let inp = buildPriceInputs(await repo.listPrices(U), PURITIES);
  assert.equal(inp.market24k, 1_700_000);
  assert.equal(inp.market24kBasis, 'spot');

  await add({ price_type: 'retail_batangan', brand_id: 1, purity_id: 1, price_per_gram: 2_500_000, effective_at: '2026-11-25T01:00:00Z' });
  await add({ price_type: 'buyback_batangan', brand_id: 1, purity_id: 1, price_per_gram: 2_300_000 });
  await add({ price_type: 'buyback_perhiasan', purity_id: 5, price_per_gram: 1_500_000, effective_at: '2026-11-20T01:00:00Z' });
  await add({ price_type: 'buyback_perhiasan', purity_id: 5, price_per_gram: 1_600_000, effective_at: '2026-11-24T01:00:00Z' });
  inp = buildPriceInputs(await repo.listPrices(U), PURITIES);
  assert.equal(inp.market24k, 2_500_000);
  assert.equal(inp.market24kBasis, 'retail_batangan');
  assert.equal(inp.buyback24k, 2_300_000);
  assert.deepEqual(inp.buybackByPurity, { '18K': 1_600_000 }); // yang terbaru menang
});

test('harga: nilai tidak valid ditolak', async () => {
  await assert.rejects(() => repo.addPrice(U, { source_id: 2, price_type: 'spot', price_per_gram: 0, effective_at: '2026-11-26' }), (e) => !!e.fields.price_per_gram);
});

test('konversi spot: USD/oz x kurs / 31,1034768 g', async () => {
  assert.equal(spotPerGramIDR(3400, 16000), 1_749_001);
  const fake = async (url) => ({
    ok: true,
    json: async () => (url.includes('gold-api') ? { price: 3400, updatedAt: '2026-11-26T01:00:00Z' } : { rates: { IDR: 16000 } }),
  });
  const r = await fetchSpotIDR(fake);
  assert.equal(r.perGram, 1_749_001);
  await assert.rejects(() => fetchSpotIDR(async () => ({ ok: false })));
  await assert.rejects(() => fetchSpotIDR(async () => ({ ok: true, json: async () => ({}) })));
});

// ---------------- Sinkronisasi ----------------
test('sync: kirim data lokal ke server, tandai selesai, lalu perangkat baru bisa menarik semuanya', async () => {
  const { srv, client } = makeServer();
  const a = await repo.saveAsset(U, bullion);
  const photo = new Blob(['foto'], { type: 'image/jpeg' });
  await repo.saveAsset(U, bullion, { ...a }); // simpan ulang tanpa foto
  const cur = (await repo.listAssets(U))[0];
  await repo.saveAsset(U, { ...bullion, photoBlob: photo }, cur);
  const cur2 = (await repo.listAssets(U))[0];
  await repo.sellAsset(U, cur2, { trx_date: '2026-12-01', total: 16_000_000 });
  await repo.addPrice(U, { source_id: 2, price_type: 'retail_batangan', brand_id: 1, purity_id: 1, price_per_gram: 2_500_000, effective_at: '2026-11-26T01:00:00Z' });
  assert.ok((await repo.pendingCount(U)) > 0);

  const s = await sync.runSync(client, U);
  assert.equal(s.error, null);
  assert.equal(s.failed, 0);
  assert.equal(srv.tables.assets.length, 1);
  assert.equal(srv.tables.transactions.length, 2);
  assert.equal(srv.tables.price_history.length, 1);
  assert.equal(srv.files.size, 1);
  assert.equal(await repo.pendingCount(U), 0);
  assert.ok(await sync.readLastSync(U));
  assert.ok((await sync.readMaster()).purities.length > 0);
  assert.equal(typeof (await sync.readMaster()).purities[0].fineness, 'number');

  // Perangkat baru: penyimpanan lokal kosong
  db.resetMemoryForTests();
  const s2 = await sync.runSync(client, U);
  assert.equal(s2.error, null);
  const assets = await repo.listAssets(U);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].status, 'sold');
  assert.equal(typeof assets[0].purchase_price, 'number');
  assert.equal((await repo.listTransactions(U)).length, 2);
  assert.equal((await repo.listPrices(U)).length, 1);
  assert.equal(await repo.pendingCount(U), 0);

  const url = await repo.getFileUrl(client, 'asset-photos', assets[0].photo_path);
  assert.ok(url && url.startsWith('blob:'));
});

test('sync: hapus (tombstone) ikut tersinkron dan tidak hidup kembali', async () => {
  const { srv, client } = makeServer();
  const a = await repo.saveAsset(U, bullion);
  await sync.runSync(client, U);
  await repo.deleteAsset(U, a);
  await sync.runSync(client, U);
  assert.ok(srv.tables.assets[0].deleted_at);

  db.resetMemoryForTests();
  await sync.runSync(client, U);
  assert.equal((await repo.listAssets(U)).length, 0);
  assert.equal((await repo.listTransactions(U)).length, 0);
});

test('sync: gagal kirim (offline) -> data tetap pending dan tidak ditimpa saat tarik', async () => {
  const { srv, client } = makeServer();
  const a = await repo.saveAsset(U, bullion);
  await sync.runSync(client, U);

  // perangkat lain mengubah nama di server
  srv.tables.assets[0].name = 'Nama dari perangkat lain';
  srv.tables.assets[0].updated_at = srv.tick();

  // perubahan lokal saat koneksi bermasalah
  const cur = (await repo.listAssets(U))[0];
  await repo.saveAsset(U, { ...bullion, name: 'Nama lokal' }, cur);
  srv.failUpserts = true;
  const s = await sync.runSync(client, U);
  assert.ok(s.failed > 0);
  assert.equal((await repo.listAssets(U))[0].name, 'Nama lokal');
  assert.ok((await repo.pendingCount(U)) > 0);

  // koneksi pulih: perubahan lokal terkirim
  srv.failUpserts = false;
  const s2 = await sync.runSync(client, U);
  assert.equal(s2.error, null);
  assert.equal(srv.tables.assets[0].name, 'Nama lokal');
  assert.equal(await repo.pendingCount(U), 0);
  assert.ok(a);
});

test('sync: baris pending yang diubah saat proses kirim tidak hilang', async () => {
  const { srv, client } = makeServer();
  const a = await repo.saveAsset(U, bullion);
  const p = sync.runSync(client, U);
  await repo.saveAsset(U, { ...bullion, name: 'Diubah saat sync' }, await db.get('assets', a.id));
  await p;
  // apa pun hasil balapan waktunya, perubahan terbaru tidak boleh hilang
  assert.equal((await repo.listAssets(U))[0].name, 'Diubah saat sync');
  await sync.runSync(client, U);
  assert.equal(srv.tables.assets[0].name, 'Diubah saat sync');
  assert.equal(await repo.pendingCount(U), 0);
});
