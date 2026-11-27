import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { CompareBars, Donut } from '../components/charts';
import { useData } from '../context/DataContext';
import { groupPerformance, composition } from '../lib/analytics';
import { valueAsset, roi } from '../lib/calc';
import { JEWELRY_TYPES } from '../lib/constants';
import { formatRupiah, formatGram, formatPercent } from '../lib/format';

const TABS = [['pl', 'Untung/rugi'], ['perf', 'Performa'], ['comp', 'Komposisi'], ['val', 'Valuasi']];
const GROUPS = [['merk', 'Merk'], ['kadar', 'Kadar'], ['jenis', 'Jenis'], ['item', 'Item'], ['periode', 'Periode beli']];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const plClass = (n) => (n == null ? '' : n >= 0 ? 'pos' : 'neg');
const money = (n) => (n == null ? 'Harga belum ada' : formatRupiah(n));

export default function Analysis() {
  const [tab, setTab] = useState('pl');
  const { assets, ready } = useData();
  if (!ready) return null;
  return (
    <>
      <h2 className="page-title">Analisis</h2>
      <div className="chips">
        {TABS.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {!assets.length ? (
        <div className="card empty">
          <div className="ico"><BarChart3 size={28} /></div>
          <b style={{ color: 'var(--text)' }}>Belum ada data</b>
          <p style={{ margin: '6px 0 0' }}>Analisis muncul setelah Anda mencatat aset emas.</p>
        </div>
      ) : tab === 'pl' ? <ProfitLoss /> : tab === 'perf' ? <Performance /> : tab === 'comp' ? <Composition /> : <Valuation />}
    </>
  );
}

function ProfitLoss() {
  const { summary: s, realized, priceInputs } = useData();
  const noPrice = !priceInputs.market24k;
  const total = noPrice ? null : s.unrealizedPL + realized.realizedPL;
  const invested = s.capital + realized.cogs; // seluruh modal yang pernah dipakai pada aset aktif + aset terjual
  const avgPerGram = s.totalGrams > 0 ? s.capital / s.totalGrams : 0;

  return (
    <>
      <div className="card glass">
        <div className="muted small">Total untung/rugi (terealisasi + belum)</div>
        <div className={`num ${plClass(total)}`} style={{ fontSize: 26, fontWeight: 600 }}>{money(total)}</div>
        {total != null && <div className={`small ${plClass(total)}`}>Return keseluruhan {formatPercent(roi(total, invested))}</div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="kv"><span>Total modal (aset aktif)</span><span className="num">{formatRupiah(s.capital)}</span></div>
        <div className="kv"><span>Nilai pasar</span><span className="num">{noPrice ? 'Harga belum ada' : formatRupiah(s.marketValue)}</span></div>
        <div className="kv"><span>Estimasi nilai jual kembali</span><span className="num">{noPrice ? 'Harga belum ada' : formatRupiah(s.liquidationValue)}</span></div>
        <div className="kv"><span>Untung/rugi belum terealisasi</span><b className={`num ${plClass(noPrice ? null : s.unrealizedPL)}`}>{noPrice ? '-' : formatRupiah(s.unrealizedPL)}</b></div>
        <div className="kv"><span>Return belum terealisasi (ROI)</span><b className={`num ${plClass(noPrice ? null : s.roiPercent)}`}>{noPrice ? '-' : formatPercent(s.roiPercent)}</b></div>
        <div className="kv"><span>Untung/rugi terealisasi</span><b className={`num ${plClass(realized.realizedPL)}`}>{formatRupiah(realized.realizedPL)}</b></div>
        <div className="kv"><span>Aset terjual</span><span className="num">{realized.soldCount}</span></div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="kv"><span>Total gramasi (berat bersih)</span><span className="num">{formatGram(s.totalGrams)}</span></div>
        <div className="kv"><span>Total emas murni</span><span className="num">{formatGram(s.totalPureGrams)}</span></div>
        <div className="kv"><span>Harga perolehan rata-rata per gram</span><span className="num">{s.totalGrams > 0 ? formatRupiah(avgPerGram) : '-'}</span></div>
        <div className="kv"><span>Harga rata-rata per gram emas murni</span><span className="num">{s.totalPureGrams > 0 ? formatRupiah(s.avgPricePerPureGram) : '-'}</span></div>
        <div className="formula">
          Untung/rugi belum terealisasi = estimasi jual kembali − modal.<br />
          Untung/rugi terealisasi = hasil penjualan bersih − modal aset yang dijual (per aset).<br />
          ROI = untung/rugi ÷ modal × 100%.
          {s.liquidationIsEstimate && <><br />Estimasi jual kembali bukan penawaran resmi toko.</>}
        </div>
      </div>
    </>
  );
}

function Performance() {
  const { assets, priceInputs, master } = useData();
  const [by, setBy] = useState('merk');
  const active = useMemo(() => assets.filter((a) => a.status !== 'sold'), [assets]);

  const rows = useMemo(() => {
    const brand = (id) => master.brands.find((b) => b.id === id)?.name;
    const fns = {
      merk: (a) => (a.category === 'perhiasan' ? { key: 'perhiasan', label: 'Perhiasan' } : { key: a.brand_id, label: brand(a.brand_id) ?? 'Tanpa merk' }),
      kadar: (a) => ({ key: a.purity_code, label: a.purity_code }),
      jenis: (a) => (a.category === 'perhiasan'
        ? { key: `p-${a.jewelry_type}`, label: `Perhiasan • ${JEWELRY_TYPES.find(([k]) => k === a.jewelry_type)?.[1] ?? 'Lainnya'}` }
        : { key: `l-${a.product_type || 'x'}`, label: `Logam mulia • ${a.product_type || 'Lainnya'}` }),
      item: (a) => ({ key: a.id, label: a.name }),
      periode: (a) => {
        const [y, m] = a.purchase_date.split('-');
        return { key: `${y}-${m}`, label: `${MONTHS[Number(m) - 1]} ${y}` };
      },
    };
    const r = groupPerformance(active, priceInputs, master.settings, fns[by]);
    return by === 'periode' ? r.sort((a, b) => String(b.key).localeCompare(String(a.key))) : r;
  }, [active, priceInputs, master, by]);

  return (
    <>
      <div className="chips">
        {GROUPS.map(([k, l]) => <button key={k} className={`chip ${by === k ? 'on' : ''}`} onClick={() => setBy(k)}>{l}</button>)}
      </div>
      {!rows.length ? <div className="card empty">Belum ada aset aktif.</div> : rows.map((g) => (
        <div className="asset-card" key={g.key} style={{ cursor: 'default' }}>
          <span className="grow">
            <div className="t">{g.label}</div>
            <div className="s">{g.count} item • {formatGram(g.grams)} • modal {formatRupiah(g.capital)}</div>
          </span>
          <span className="r">
            {g.pl == null ? <span className="small muted">Harga belum ada</span> : (
              <>
                <div className={`num ${plClass(g.pl)}`}>{g.pl >= 0 ? '+' : ''}{formatRupiah(g.pl)}</div>
                <div className={`small num ${plClass(g.roi)}`}>{formatPercent(g.roi)}{g.missing ? ' (sebagian)' : ''}</div>
              </>
            )}
          </span>
        </div>
      ))}
      <p className="muted small">Berdasarkan estimasi nilai jual kembali terhadap modal tiap aset aktif.</p>
    </>
  );
}

function Composition() {
  const { assets } = useData();
  const [by, setBy] = useState('category');
  const active = assets.filter((a) => a.status !== 'sold');
  const data = composition(active, by);
  return (
    <div className="card">
      <div className="seg">
        <button className={by === 'category' ? 'on' : ''} onClick={() => setBy('category')}>Jenis emas</button>
        <button className={by === 'purity' ? 'on' : ''} onClick={() => setBy('purity')}>Kadar</button>
      </div>
      {data.length ? <Donut data={data} /> : <p className="muted small">Belum ada aset aktif.</p>}
      <p className="muted small" style={{ marginBottom: 0 }}>Berdasarkan berat bersih (gram) aset aktif.</p>
    </div>
  );
}

const BASIS = {
  buyback_kadar: 'Harga buyback sesuai kadar',
  estimasi_buyback_24k: 'Estimasi dari buyback 24K',
  estimasi_faktor_pasar: 'Estimasi dari harga pasar',
  tidak_ada_harga: 'Belum ada harga',
};

function Valuation() {
  const { assets, summary: s, priceInputs, master } = useData();
  const noPrice = !priceInputs.market24k;
  const counts = {};
  for (const a of assets.filter((x) => x.status !== 'sold')) {
    const b = valueAsset(a, priceInputs, master.settings).liquidationBasis;
    counts[b] = (counts[b] || 0) + 1;
  }
  const diff = (a, b) => formatRupiah(a - b);

  return (
    <>
      <div className="card">
        {noPrice ? <p className="muted small" style={{ margin: 0 }}>Isi harga di menu Harga agar tiga nilai bisa dibandingkan.</p> : (
          <>
            <CompareBars capital={s.capital} market={s.marketValue} liquidation={s.liquidationValue} />
            <div className="kv"><span>Nilai akuisisi (modal)</span><span className="num">{formatRupiah(s.capital)}</span></div>
            <div className="kv"><span>Nilai pasar</span><span className="num">{formatRupiah(s.marketValue)}</span></div>
            <div className="kv"><span>Estimasi nilai likuidasi</span><span className="num">{formatRupiah(s.liquidationValue)}</span></div>
            <div className="kv"><span>Selisih pasar − akuisisi</span><span className={`num ${plClass(s.marketValue - s.capital)}`}>{diff(s.marketValue, s.capital)}</span></div>
            <div className="kv"><span>Selisih pasar − likuidasi</span><span className="num">{diff(s.marketValue, s.liquidationValue)}</span></div>
          </>
        )}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 6 }}>Dasar perhitungan likuidasi</h3>
        {Object.keys(counts).length ? Object.entries(counts).map(([k, n]) => (
          <div className="kv" key={k}><span>{BASIS[k]}</span><span className="num">{n} aset</span></div>
        )) : <p className="muted small">Belum ada aset aktif.</p>}
        <div className="formula">
          Nilai akuisisi = harga beli + biaya tambahan.<br />
          Nilai pasar = berat bersih × harga emas 24K × kadar.<br />
          Nilai likuidasi = estimasi uang yang diterima bila seluruh aset dijual ke toko (harga buyback), bukan penawaran resmi.
        </div>
      </div>
    </>
  );
}
