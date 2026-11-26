// Penyimpanan lokal di HP/peramban (IndexedDB). Bila IndexedDB tidak tersedia
// (mis. mode privat tertentu) otomatis memakai memori: data tetap jalan, tetapi hilang saat ditutup.
const NAME = 'goldbite';
const VERSION = 1;
const KEYS = { assets: 'id', transactions: 'id', prices: 'id', files: 'path', meta: 'key' };

const mem = Object.fromEntries(Object.keys(KEYS).map((s) => [s, new Map()]));
let dbp = null;

function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [s, k] of Object.entries(KEYS)) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: k });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
const handle = () => openDb().catch(() => null);
const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const clone = (v) => (v === undefined ? v : structuredClone(v));

export async function getAll(store) {
  const d = await handle();
  if (!d) return [...mem[store].values()].map(clone);
  return wrap(d.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const d = await handle();
  if (!d) return clone(mem[store].get(key));
  return wrap(d.transaction(store).objectStore(store).get(key));
}

// Tulis beberapa data sekaligus dalam satu transaksi (semua berhasil atau semua batal)
export async function batchPut(entries) {
  const d = await handle();
  if (!d) {
    for (const [s, v] of entries) mem[s].set(v[KEYS[s]], clone(v));
    return;
  }
  const tx = d.transaction([...new Set(entries.map((e) => e[0]))], 'readwrite');
  for (const [s, v] of entries) tx.objectStore(s).put(v);
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

export const put = (store, value) => batchPut([[store, value]]);

// Hanya untuk tes
export function resetMemoryForTests() {
  for (const m of Object.values(mem)) m.clear();
}
