// Server Supabase tiruan (di memori) untuk menguji sync tanpa internet.
export function makeServer() {
  let clock = Date.parse('2026-11-26T08:00:00Z');
  const srv = {
    tick: () => new Date((clock += 1000)).toISOString(),
    seq: 0,
    failUpserts: false,
    tables: {
      assets: [], transactions: [], price_history: [],
      brands: [{ id: 1, name: 'Antam', is_active: true }, { id: 2, name: 'UBS', is_active: true }],
      purities: [{ id: 1, code: '24K', fineness: '0.9999', is_active: true }, { id: 5, code: '18K', fineness: '0.75', is_active: true }],
      price_sources: [{ id: 1, name: 'API Harga Spot', kind: 'api' }, { id: 2, name: 'Input Manual', kind: 'manual' }],
      system_settings: [{ key: 'jewelry_buyback_factor', value: 0.85 }],
    },
    files: new Map(),
  };

  class Q {
    constructor(table) { Object.assign(this, { table, filters: [], mode: 'select', one: false, ord: null, lim: Infinity }); }
    upsert(payload, opts) { this.mode = 'upsert'; this.payload = payload; this.opts = opts || {}; return this; }
    select() { return this; }
    single() { this.one = true; return this; }
    eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
    gte(c, v) { this.filters.push((r) => r[c] >= v); return this; }
    gt(c, v) { this.filters.push((r) => r[c] > v); return this; }
    order(c, o) { this.ord = [c, !o || o.ascending !== false]; return this; }
    limit(n) { this.lim = n; return this; }
    then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
    exec() {
      const rows = srv.tables[this.table];
      if (this.mode === 'upsert') {
        if (srv.failUpserts) return { data: null, error: { message: 'Failed to fetch' } };
        const key = this.opts.onConflict || 'id';
        const p = this.payload;
        const ex = rows.find((r) => r[key] === p[key]);
        if (ex) {
          if (ex.user_id !== p.user_id) return { data: null, error: { message: 'RLS' } };
          if (this.opts.ignoreDuplicates) return { data: [], error: null };
          Object.assign(ex, p, { version: ex.version + 1, updated_at: srv.tick() });
          return { data: this.one ? { ...ex } : [{ ...ex }], error: null };
        }
        const row = { ...p, updated_at: p.updated_at || srv.tick() };
        if (this.table === 'price_history') row.id = ++srv.seq;
        rows.push(row);
        return { data: this.one ? { ...row } : [{ ...row }], error: null };
      }
      let out = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.table === 'price_history') out = out.filter((r) => r.user_id == null || r.user_id === 'u1');
      if (this.ord) { const [c, asc] = this.ord; out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)); }
      return { data: out.slice(0, this.lim).map((r) => ({ ...r })), error: null };
    }
  }

  const client = {
    from: (t) => new Q(t),
    storage: {
      from: (bucket) => ({
        upload: async (path, blob) => { srv.files.set(`${bucket}/${path}`, blob); return { error: null }; },
        download: async (path) => {
          const b = srv.files.get(`${bucket}/${path}`);
          return b ? { data: b, error: null } : { data: null, error: { message: 'not found' } };
        },
      }),
    },
  };
  return { srv, client };
}
