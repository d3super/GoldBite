// Lapisan data "local-first": semua perubahan ditulis ke penyimpanan lokal lebih dulu
// (cepat & jalan offline), ditandai _pending, lalu sync.js mengirimnya ke Supabase saat online.
import * as db from './db.js';
import { netWeight } from './calc.js';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round(Number(n) * 10000) / 10000;
const nowIso = () => new Date().toISOString();
const newId = () => globalThis.crypto.randomUUID();
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));

const listeners = new Set();
export const onLocalChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => { try { f(); } catch { /* abaikan */ } });
const bump = (rec) => ({ ...rec, _pending: true, _rev: (rec._rev ?? 0) + 1 });

// ---------- Baca ----------
export async function listAssets(uid) {
  return (await db.getAll('assets')).filter((a) => a.user_id === uid && !a.deleted_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function listTransactions(uid) {
  return (await db.getAll('transactions')).filter((t) => t.user_id === uid && !t.deleted_at)
    .sort((a, b) => String(b.trx_date).localeCompare(String(a.trx_date)) || String(b.created_at).localeCompare(String(a.created_at)));
}

// Harga milik sendiri + harga global (user_id kosong)
export async function listPrices(uid) {
  return (await db.getAll('prices')).filter((p) => p.user_id === uid || p.user_id == null)
    .sort((a, b) => Date.parse(b.effective_at) - Date.parse(a.effective_at));
}

export async function pendingCount(uid) {
  const [a, t, p, f] = await Promise.all(['assets', 'transactions', 'prices', 'files'].map(db.getAll));
  return a.filter((x) => x.user_id === uid && x._pending).length
    + t.filter((x) => x.user_id === uid && x._pending).length
    + p.filter((x) => x.user_id === uid && x._pending).length
    + f.filter((x) => x.path.startsWith(`${uid}/`) && !x.uploaded).length;
}

// ---------- Validasi ----------
export function validateAsset(f) {
  const e = {};
  const isJ = f.category === 'perhiasan';
  if (!String(f.name || '').trim()) e.name = 'Nama wajib diisi';
  if (!f.purity_id) e.purity_id = 'Pilih kadar';
  if (!isDate(f.purchase_date)) e.purchase_date = 'Tanggal tidak valid';
  if (!(Number(f.purchase_price) > 0)) e.purchase_price = 'Harga beli harus lebih dari 0';
  if (Number(f.extra_cost) < 0) e.extra_cost = 'Tidak boleh negatif';
  if (isJ) {
    if (!(Number(f.gross_weight) > 0)) e.gross_weight = 'Berat bruto harus lebih dari 0';
    else if (Number(f.stone_weight || 0) < 0) e.stone_weight = 'Tidak boleh negatif';
    else if (!(netWeight(f.gross_weight, f.stone_weight) > 0)) e.stone_weight = 'Berat batu harus lebih kecil dari berat bruto';
  } else if (!(Number(f.net_weight) > 0)) e.net_weight = 'Berat harus lebih dari 0';
  return e;
}

export function validateSale(asset, f) {
  const e = {};
  if (!asset) e.asset = 'Pilih aset';
  else if (asset.status === 'sold') e.asset = 'Aset ini sudah terjual';
  if (!isDate(f.trx_date)) e.trx_date = 'Tanggal tidak valid';
  if (!(Number(f.total) > 0)) e.total = 'Total penjualan harus lebih dari 0';
  if (Number(f.extra_cost) < 0) e.extra_cost = 'Tidak boleh negatif';
  if (Number(f.tax) < 0) e.tax = 'Tidak boleh negatif';
  return e;
}

const fail = (fields) => Object.assign(new Error('VALIDATION'), { fields });

// ---------- Aset (+ transaksi beli otomatis) ----------
export async function saveAsset(uid, f, existing = null) {
  const errs = validateAsset(f);
  if (Object.keys(errs).length) throw fail(errs);

  const id = existing?.id ?? newId();
  const ts = nowIso();
  const isJ = f.category === 'perhiasan';
  const net = r4(isJ ? netWeight(f.gross_weight, f.stone_weight) : f.net_weight);

  const entries = [];
  let photo_path = existing?.photo_path ?? null;
  if (f.photoBlob) {
    photo_path = `${uid}/${id}.jpg`;
    entries.push(['files', { path: photo_path, bucket: 'asset-photos', blob: f.photoBlob, uploaded: false }]);
    fileUrlCache.delete(photo_path);
  } else if (f.removePhoto) photo_path = null;

  const asset = bump({
    id, user_id: uid, category: f.category, name: String(f.name).trim(),
    brand_id: isJ ? null : (f.brand_id ?? null),
    product_type: isJ ? null : (f.product_type || null),
    jewelry_type: isJ ? (f.jewelry_type || 'lainnya') : null,
    purity_id: Number(f.purity_id),
    gross_weight: isJ ? r4(f.gross_weight) : null,
    stone_weight: isJ ? r4(f.stone_weight || 0) : 0,
    net_weight: net,
    serial_number: isJ ? null : (String(f.serial_number || '').trim() || null),
    purchase_date: f.purchase_date,
    purchase_price: r2(f.purchase_price),
    extra_cost: r2(f.extra_cost || 0),
    store: String(f.store || '').trim() || null,
    photo_path,
    notes: String(f.notes || '').trim() || null,
    status: existing?.status ?? 'active',
    client_id: null,
    version: existing?.version ?? 1,
    created_at: existing?.created_at ?? ts,
    updated_at: ts,
    deleted_at: null,
    _rev: existing?._rev ?? 0,
  });

  // Transaksi "beli" otomatis agar riwayat transaksi & laba terealisasi (WAC) selalu konsisten
  const prevBuy = (await db.getAll('transactions')).find((t) => t.asset_id === id && t.type === 'beli' && !t.deleted_at);
  const buy = bump({
    id: prevBuy?.id ?? newId(), user_id: uid, asset_id: id, type: 'beli',
    trx_date: asset.purchase_date, weight_g: net,
    price_per_g: r2(asset.purchase_price / net), total: asset.purchase_price,
    extra_cost: asset.extra_cost, tax: 0, location: asset.store, receipt_path: null, notes: null,
    client_id: null, version: prevBuy?.version ?? 1,
    created_at: prevBuy?.created_at ?? ts, updated_at: ts, deleted_at: null, _rev: prevBuy?._rev ?? 0,
  });

  await db.batchPut([['assets', asset], ['transactions', buy], ...entries]);
  emit();
  return asset;
}

// Hapus = tombstone (ditandai terhapus agar sinkronisasi tidak menghidupkannya kembali)
export async function deleteAsset(uid, asset) {
  const ts = nowIso();
  const trx = (await db.getAll('transactions')).filter((t) => t.asset_id === asset.id && !t.deleted_at);
  await db.batchPut([
    ['assets', bump({ ...asset, deleted_at: ts, updated_at: ts })],
    ...trx.map((t) => ['transactions', bump({ ...t, deleted_at: ts, updated_at: ts })]),
  ]);
  emit();
}

// ---------- Penjualan ----------
export async function sellAsset(uid, asset, f) {
  const errs = validateSale(asset, f);
  if (Object.keys(errs).length) throw fail(errs);
  const ts = nowIso();
  const id = newId();
  const entries = [];
  let receipt_path = null;
  if (f.receiptBlob) {
    receipt_path = `${uid}/${id}.jpg`;
    entries.push(['files', { path: receipt_path, bucket: 'receipts', blob: f.receiptBlob, uploaded: false }]);
  }
  const sale = bump({
    id, user_id: uid, asset_id: asset.id, type: 'jual', trx_date: f.trx_date,
    weight_g: asset.net_weight, price_per_g: r2(f.total / asset.net_weight), total: r2(f.total),
    extra_cost: r2(f.extra_cost || 0), tax: r2(f.tax || 0),
    location: String(f.location || '').trim() || null, receipt_path,
    notes: String(f.notes || '').trim() || null,
    client_id: null, version: 1, created_at: ts, updated_at: ts, deleted_at: null, _rev: 0,
  });
  await db.batchPut([['transactions', sale], ['assets', bump({ ...asset, status: 'sold', updated_at: ts })], ...entries]);
  emit();
  return sale;
}

// Batalkan penjualan: transaksi jual dihapus (tombstone) dan aset aktif kembali
export async function cancelSale(uid, trx) {
  const ts = nowIso();
  const asset = trx.asset_id ? await db.get('assets', trx.asset_id) : null;
  const entries = [['transactions', bump({ ...trx, deleted_at: ts, updated_at: ts })]];
  if (asset && !asset.deleted_at) entries.push(['assets', bump({ ...asset, status: 'active', updated_at: ts })]);
  await db.batchPut(entries);
  emit();
}

// ---------- Harga ----------
export async function addPrice(uid, p) {
  if (!(Number(p.price_per_gram) > 0)) throw fail({ price_per_gram: 'Harga harus lebih dari 0' });
  if (!p.price_type) throw fail({ price_type: 'Pilih jenis harga' });
  if (Number.isNaN(Date.parse(p.effective_at))) throw fail({ effective_at: 'Waktu tidak valid' });
  const id = newId();
  const rec = {
    id, client_id: id, user_id: uid, source_id: p.source_id, price_type: p.price_type,
    brand_id: p.brand_id ?? null, purity_id: p.purity_id ?? null,
    price_per_gram: r2(p.price_per_gram), currency: 'IDR',
    effective_at: new Date(p.effective_at).toISOString(), created_at: nowIso(),
    _pending: true, _rev: 1,
  };
  await db.put('prices', rec);
  emit();
  return rec;
}

// ---------- Foto / bukti ----------
export const fileUrlCache = new Map();

// Ambil dari penyimpanan lokal; bila belum ada dan online, unduh dari Supabase lalu simpan lokal
export async function getFileUrl(client, bucket, path) {
  if (!path) return null;
  if (fileUrlCache.has(path)) return fileUrlCache.get(path);
  let rec = await db.get('files', path);
  if (!rec && client && (typeof navigator === 'undefined' || navigator.onLine)) {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (!error && data) {
      rec = { path, bucket, blob: data, uploaded: true };
      await db.put('files', rec);
    }
  }
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  fileUrlCache.set(path, url);
  return url;
}
