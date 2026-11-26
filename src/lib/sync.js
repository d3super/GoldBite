// Sinkronisasi dasar: kirim perubahan lokal (_pending) ke Supabase, lalu ambil perubahan terbaru.
// Aturan konflik Fase 3: perubahan lokal yang belum terkirim tidak ditimpa saat mengambil data;
// bila dua perangkat mengubah data yang sama, perubahan yang terkirim terakhir menang.
// (Aturan konflik lengkap + riwayat sinkronisasi dikerjakan di Fase 5.)
import * as db from './db.js';

const ASSET_COLS = ['id', 'user_id', 'category', 'name', 'brand_id', 'product_type', 'jewelry_type', 'purity_id',
  'gross_weight', 'stone_weight', 'net_weight', 'serial_number', 'purchase_date', 'purchase_price', 'extra_cost',
  'store', 'photo_path', 'notes', 'status', 'client_id', 'version', 'created_at', 'updated_at', 'deleted_at'];
const TRX_COLS = ['id', 'user_id', 'asset_id', 'type', 'trx_date', 'weight_g', 'price_per_g', 'total', 'extra_cost',
  'tax', 'location', 'receipt_path', 'notes', 'client_id', 'version', 'created_at', 'updated_at', 'deleted_at'];
const PRICE_COLS = ['user_id', 'source_id', 'price_type', 'brand_id', 'purity_id', 'price_per_gram', 'currency',
  'effective_at', 'client_id'];
const NUMERIC = {
  assets: ['gross_weight', 'stone_weight', 'net_weight', 'purchase_price', 'extra_cost'],
  transactions: ['weight_g', 'price_per_g', 'total', 'extra_cost', 'tax'],
};

const pick = (o, cols) => Object.fromEntries(cols.map((c) => [c, o[c] === undefined ? null : o[c]]));
function normalize(table, row) {
  const out = { ...row };
  for (const c of NUMERIC[table] || []) if (out[c] != null) out[c] = Number(out[c]);
  return out;
}

async function uploadFiles(client, uid) {
  let failed = 0, error = null;
  const files = (await db.getAll('files')).filter((f) => !f.uploaded && f.path.startsWith(`${uid}/`));
  for (const f of files) {
    const { error: e } = await client.storage.from(f.bucket).upload(f.path, f.blob, { upsert: true, contentType: 'image/jpeg' });
    if (e) { failed++; error = error || e; continue; }
    await db.put('files', { ...f, uploaded: true });
  }
  return { pushed: files.length - failed, failed, error };
}

async function pushRows(client, uid, store, table, cols) {
  let pushed = 0, failed = 0, error = null;
  const rows = (await db.getAll(store)).filter((r) => r.user_id === uid && r._pending);
  for (const r of rows) {
    const payload = pick(r, cols);
    const isPrice = table === 'price_history';
    const q = client.from(table);
    const res = isPrice
      ? await q.upsert(payload, { onConflict: 'client_id', ignoreDuplicates: true }).select()
      : await q.upsert(payload, { onConflict: 'id' }).select().single();
    if (res.error) { failed++; error = error || res.error; continue; }
    // Hanya tandai selesai bila tidak ada perubahan lokal baru selama proses kirim
    const cur = await db.get(store, r.id);
    if (cur && cur._rev === r._rev) {
      const server = !isPrice && res.data ? normalize(table, res.data) : {};
      await db.put(store, { ...cur, ...server, _pending: false });
    }
    pushed++;
  }
  return { pushed, failed, error };
}

async function pullByUpdatedAt(client, uid, store, table) {
  const key = `pull:${uid}:${table}`;
  let cursor = (await db.get('meta', key))?.value ?? '1970-01-01T00:00:00Z';
  for (let page = 0; page < 40; page++) {
    const { data, error } = await client.from(table).select('*').eq('user_id', uid)
      .gte('updated_at', cursor).order('updated_at', { ascending: true }).limit(500);
    if (error) throw error;
    for (const row of data) {
      const local = await db.get(store, row.id);
      if (local?._pending) continue; // jangan timpa perubahan lokal yang belum terkirim
      await db.put(store, { ...normalize(table, row), _pending: false, _rev: local?._rev ?? 0 });
    }
    if (!data.length) break;
    const last = data[data.length - 1].updated_at;
    const stop = data.length < 500 || last === cursor;
    cursor = last;
    if (stop) break;
  }
  await db.put('meta', { key, value: cursor });
}

async function pullPrices(client, uid) {
  const key = `pull:${uid}:price_history`;
  let lastId = (await db.get('meta', key))?.value ?? 0;
  for (let page = 0; page < 40; page++) {
    const { data, error } = await client.from('price_history').select('*').gt('id', lastId).order('id', { ascending: true }).limit(500);
    if (error) throw error;
    for (const row of data) {
      const id = row.client_id || `srv-${row.id}`;
      const local = await db.get('prices', id);
      if (local?._pending) continue;
      await db.put('prices', { ...row, id, price_per_gram: Number(row.price_per_gram), _pending: false, _rev: local?._rev ?? 0 });
    }
    if (!data.length) break;
    lastId = data[data.length - 1].id;
    if (data.length < 500) break;
  }
  await db.put('meta', { key, value: lastId });
}

async function pullMaster(client) {
  const [b, p, s, st] = await Promise.all(['brands', 'purities', 'price_sources', 'system_settings'].map((t) => client.from(t).select('*')));
  const err = b.error || p.error || s.error || st.error;
  if (err) throw err;
  const settings = {};
  for (const r of st.data) settings[r.key] = Number(r.value);
  await db.put('meta', {
    key: 'master',
    value: {
      brands: b.data.filter((x) => x.is_active).sort((x, y) => x.id - y.id),
      purities: p.data.filter((x) => x.is_active).map((x) => ({ ...x, fineness: Number(x.fineness) })).sort((x, y) => x.id - y.id),
      sources: s.data,
      settings,
    },
  });
}

export const readMaster = async () => (await db.get('meta', 'master'))?.value ?? null;
export const readLastSync = async (uid) => (await db.get('meta', `last_sync:${uid}`))?.value ?? null;

let running = null;

// Jalankan sinkronisasi (tidak akan berjalan dobel). Mengembalikan { pushed, failed, error }
export function runSync(client, uid) {
  if (running) return running;
  running = (async () => {
    const summary = { pushed: 0, failed: 0, error: null };
    const add = (r) => { summary.pushed += r.pushed; summary.failed += r.failed; summary.error = summary.error || r.error; };
    try {
      add(await uploadFiles(client, uid));
      add(await pushRows(client, uid, 'assets', 'assets', ASSET_COLS)); // aset dulu (transaksi mengacu ke aset)
      add(await pushRows(client, uid, 'transactions', 'transactions', TRX_COLS));
      add(await pushRows(client, uid, 'prices', 'price_history', PRICE_COLS));
      await pullMaster(client);
      await pullByUpdatedAt(client, uid, 'assets', 'assets');
      await pullByUpdatedAt(client, uid, 'transactions', 'transactions');
      await pullPrices(client, uid);
      if (!summary.error) await db.put('meta', { key: `last_sync:${uid}`, value: new Date().toISOString() });
    } catch (e) {
      summary.error = summary.error || e;
    } finally {
      running = null;
    }
    return summary;
  })();
  return running;
}
