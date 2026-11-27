import { useMemo, useState } from 'react';
import { ProgressChart, CompareBars, Donut } from '../components/charts';
import { useData } from '../context/DataContext';
import { portfolioSeries, composition, RANGES } from '../lib/analytics';

const VIEWS = [['trend', 'Perkembangan'], ['compare', 'Modal vs nilai'], ['jenis', 'Jenis'], ['kadar', 'Kadar']];

// Satu grafik pada satu waktu agar layar tidak ramai
export default function DashboardCharts() {
  const { assets, transactions, prices, master, summary, priceInputs, ready } = useData();
  const [range, setRange] = useState('ALL');
  const [view, setView] = useState('trend');

  const active = useMemo(() => assets.filter((a) => a.status !== 'sold'), [assets]);
  const series = useMemo(
    () => portfolioSeries({ assets, transactions, prices, purities: master.purities }, range),
    [assets, transactions, prices, master.purities, range],
  );
  const noPrice = !priceInputs.market24k;

  if (!ready) return null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="chips" style={{ marginBottom: 6 }}>
        {VIEWS.map(([k, l]) => <button key={k} className={`chip ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>{l}</button>)}
      </div>

      {!assets.length ? (
        <p className="muted small" style={{ margin: '14px 0' }}>Grafik muncul setelah Anda mencatat aset pertama.</p>
      ) : view === 'trend' ? (
        <>
          <div className="chips" style={{ marginBottom: 2 }}>
            {RANGES.map(([k, l]) => <button key={k} className={`chip ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>)}
          </div>
          {series.length >= 2 ? <ProgressChart series={series} /> : <p className="muted small" style={{ margin: '14px 0' }}>Data belum cukup untuk periode ini.</p>}
          <p className="muted small" style={{ marginBottom: 0 }}>
            {noPrice ? 'Nilai pasar belum bisa digambar karena belum ada harga. Isi harga di menu Harga.'
              : 'Nilai pasar memakai harga terakhir yang tercatat pada tiap tanggal. Makin sering harga diperbarui, makin akurat grafiknya.'}
          </p>
        </>
      ) : view === 'compare' ? (
        noPrice ? <p className="muted small" style={{ margin: '14px 0' }}>Isi harga di menu Harga untuk membandingkan modal dengan nilai saat ini.</p>
          : (
            <>
              <CompareBars capital={summary.capital} market={summary.marketValue} liquidation={summary.liquidationValue} />
              <p className="muted small" style={{ marginBottom: 0 }}>Estimasi jual kembali bukan penawaran resmi toko.</p>
            </>
          )
      ) : active.length ? (
        <Donut data={composition(active, view === 'jenis' ? 'category' : 'purity')} />
      ) : <p className="muted small" style={{ margin: '14px 0' }}>Belum ada aset aktif.</p>}
    </div>
  );
}
