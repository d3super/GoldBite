import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { supabase } from '../lib/supabase';
import * as repo from '../lib/repo';
import * as sync from '../lib/sync';
import { buildPriceInputs, fetchSpotIDR } from '../lib/prices';
import { summarizePortfolio, DEFAULT_SETTINGS } from '../lib/calc';
import { PURITIES, BRANDS, SOURCES } from '../lib/constants';
import { friendlyError } from '../lib/errors';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }) {
  const { user, session, online } = useApp();
  const uid = user?.id;
  const [raw, setRaw] = useState({ assets: [], transactions: [], prices: [] });
  const [masterRaw, setMasterRaw] = useState(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [assets, transactions, prices, m, n, ls] = await Promise.all([
      repo.listAssets(uid), repo.listTransactions(uid), repo.listPrices(uid),
      sync.readMaster(), repo.pendingCount(uid), sync.readLastSync(uid),
    ]);
    setRaw({ assets, transactions, prices });
    setMasterRaw(m);
    setPending(n);
    setLastSync(ls);
    setReady(true);
  }, [uid]);

  const syncNow = useCallback(async () => {
    if (!session || !uid || !navigator.onLine) return null;
    setSyncing(true);
    const r = await sync.runSync(supabase, uid);
    setSyncError(r.error ? friendlyError(r.error) : null);
    setSyncing(false);
    await load();
    return r;
  }, [session, uid, load]);

  // Muat data lokal saat pengguna berganti
  useEffect(() => { setReady(false); load(); }, [load]);

  // Sinkronkan saat masuk / kembali online
  useEffect(() => { if (session && online) syncNow(); }, [session, online, syncNow]);

  // Setiap perubahan lokal: muat ulang tampilan, lalu kirim ke server sebentar lagi
  useEffect(() => repo.onLocalChange(() => {
    load();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => syncNow(), 1500);
  }), [load, syncNow]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const master = useMemo(() => ({
    brands: masterRaw?.brands?.length ? masterRaw.brands : BRANDS,
    purities: masterRaw?.purities?.length ? masterRaw.purities : PURITIES,
    sources: masterRaw?.sources?.length ? masterRaw.sources : SOURCES,
    settings: { ...DEFAULT_SETTINGS, ...(masterRaw?.settings || {}) },
  }), [masterRaw]);

  const assets = useMemo(() => raw.assets.map((a) => {
    const p = master.purities.find((x) => x.id === a.purity_id);
    return { ...a, fineness: p?.fineness ?? 0, purity_code: p?.code ?? '?' };
  }), [raw.assets, master.purities]);

  const priceInputs = useMemo(() => buildPriceInputs(raw.prices, master.purities), [raw.prices, master.purities]);
  const summary = useMemo(() => summarizePortfolio(assets, priceInputs, master.settings), [assets, priceInputs, master.settings]);

  const sourceId = (kind) => master.sources.find((s) => s.kind === kind)?.id ?? (kind === 'api' ? 1 : 2);
  const sourceName = (id) => master.sources.find((s) => s.id === id)?.name ?? 'Sumber lain';
  const purity24 = master.purities.find((p) => p.code === '24K');

  const actions = {
    saveAsset: (f, existing) => repo.saveAsset(uid, f, existing),
    deleteAsset: (a) => repo.deleteAsset(uid, a),
    sellAsset: (a, f) => repo.sellAsset(uid, a, f),
    cancelSale: (t) => repo.cancelSale(uid, t),
    addPrice: (p) => repo.addPrice(uid, { source_id: sourceId('manual'), ...p }),
    refreshSpot: async () => {
      const r = await fetchSpotIDR();
      await repo.addPrice(uid, {
        source_id: sourceId('api'), price_type: 'spot', purity_id: purity24?.id ?? 1,
        price_per_gram: r.perGram, effective_at: r.updatedAt,
      });
      return r;
    },
    fileUrl: (bucket, path) => repo.getFileUrl(supabase, bucket, path),
    syncNow,
  };

  const value = {
    ready, assets, transactions: raw.transactions, prices: raw.prices, master, priceInputs, summary,
    sync: { pending, lastSync, syncing, error: syncError },
    sourceName, ...actions,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
