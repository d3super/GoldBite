import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { supabase } from '../lib/supabase';
import * as repo from '../lib/repo';
import * as sync from '../lib/sync';
import { buildPriceInputs, fetchSpotIDR } from '../lib/prices';
import { summarizePortfolio, realizedPLByAsset, DEFAULT_SETTINGS } from '../lib/calc';
import { evaluateAlerts, alertMessage } from '../lib/analytics';
import { showLocalNotification } from '../lib/notify';
import { PURITIES, BRANDS, SOURCES } from '../lib/constants';
import { friendlyError } from '../lib/errors';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }) {
  const { user, session, online, notify } = useApp();
  const uid = user?.id;
  const [raw, setRaw] = useState({ assets: [], transactions: [], prices: [], alerts: [] });
  const [masterRaw, setMasterRaw] = useState(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [ready, setReady] = useState(false);
  const [seenAt, setSeenAt] = useState(() => localStorage.getItem('gb_alerts_seen') || '');
  const timer = useRef(null);
  const fired = useRef(new Set());

  const load = useCallback(async () => {
    if (!uid) return;
    const [assets, transactions, prices, alerts, m, n, ls] = await Promise.all([
      repo.listAssets(uid), repo.listTransactions(uid), repo.listPrices(uid), repo.listAlerts(uid),
      sync.readMaster(), repo.pendingCount(uid), sync.readLastSync(uid),
    ]);
    setRaw({ assets, transactions, prices, alerts });
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

  useEffect(() => { setReady(false); load(); }, [load]);
  useEffect(() => { if (session && online) syncNow(); }, [session, online, syncNow]);
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
  const realized = useMemo(() => realizedPLByAsset(assets, raw.transactions), [assets, raw.transactions]);

  // Cek notifikasi harga setiap data/harga berubah (selama aplikasi terbuka)
  useEffect(() => {
    if (!ready || !uid) return;
    const fresh = evaluateAlerts(raw.alerts, { priceInputs, summary }).filter((h) => !fired.current.has(h.alert.id));
    if (!fresh.length) return;
    fresh.forEach((h) => fired.current.add(h.alert.id));
    (async () => {
      for (const h of fresh) {
        await repo.triggerAlert(uid, h.alert);
        showLocalNotification('GOLDBITE: notifikasi harga', alertMessage(h.alert, h.current), `alert-${h.alert.id}`);
      }
      notify({ type: 'success', title: 'Notifikasi harga', message: fresh.map((h) => alertMessage(h.alert, h.current)).join('\n') });
    })();
  }, [ready, uid, raw.alerts, priceInputs, summary, notify]);

  const unseenAlerts = raw.alerts.filter((a) => a.triggered_at && a.triggered_at > seenAt).length;
  const markAlertsSeen = () => { const t = new Date().toISOString(); localStorage.setItem('gb_alerts_seen', t); setSeenAt(t); };

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
    saveAlert: (f) => repo.saveAlert(uid, f),
    setAlertActive: (a, on) => { fired.current.delete(a.id); return repo.setAlertActive(uid, a, on); },
    deleteAlert: (a) => repo.deleteAlert(uid, a),
    fileUrl: (bucket, path) => repo.getFileUrl(supabase, bucket, path),
    syncNow,
  };

  const value = {
    ready, assets, transactions: raw.transactions, prices: raw.prices, alerts: raw.alerts, master, priceInputs, summary, realized,
    unseenAlerts, markAlertsSeen, sync: { pending, lastSync, syncing, error: syncError }, sourceName, ...actions,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
