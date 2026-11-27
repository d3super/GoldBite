import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../context/AppContext';
import { formatCompact, formatRupiah, formatGram } from '../lib/format';

// Warna grafik mengikuti tema; ditulis sebagai kode warna karena atribut SVG tidak selalu mendukung var(--...)
function usePalette() {
  useApp(); // render ulang saat tema berganti
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    gold: '#D6AE55', capital: dark ? '#6FA3CF' : '#142B3B', pos: '#159B72', neg: '#D65B5B',
    axis: dark ? '#94A3B0' : '#6B7683', grid: dark ? '#23394B' : '#E4E8ED', soft: '#F2D58A',
    pie: ['#D6AE55', dark ? '#6FA3CF' : '#142B3B', '#159B72', '#8E9AA6', '#F2D58A', '#D65B5B', '#6E8FA8', '#B5883A'],
  };
}

const shortDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const tipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12, color: 'var(--text)' };

export function ProgressChart({ series }) {
  const c = usePalette();
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: c.axis, fontSize: 11 }} minTickGap={36} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCompact} tick={{ fill: c.axis, fontSize: 11 }} width={46} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tipStyle} labelFormatter={shortDate} formatter={(v, n) => [v == null ? '-' : formatRupiah(v), n]} />
          <Line type="monotone" dataKey="capital" name="Modal" stroke={c.capital} strokeWidth={2} dot={series.length <= 20} connectNulls={false} />
          <Line type="monotone" dataKey="market" name="Nilai pasar" stroke={c.gold} strokeWidth={2.4} dot={series.length <= 20} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Perbandingan tiga nilai: modal (akuisisi), nilai pasar, estimasi jual kembali
export function CompareBars({ capital, market, liquidation }) {
  const c = usePalette();
  const data = [
    { name: 'Modal', v: capital, fill: c.capital },
    { name: 'Nilai pasar', v: market, fill: c.gold },
    { name: 'Est. jual kembali', v: liquidation, fill: c.pos },
  ];
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatCompact} tick={{ fill: c.axis, fontSize: 11 }} width={46} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tipStyle} formatter={(v) => formatRupiah(v)} cursor={{ fill: 'rgba(214,174,85,0.08)' }} />
          <Bar dataKey="v" name="Nilai" radius={[8, 8, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data }) {
  const c = usePalette();
  const total = data.reduce((s, d) => s + d.grams, 0);
  return (
    <div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="grams" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={d.name} fill={c.pie[i % c.pie.length]} />)}
            </Pie>
            <Tooltip contentStyle={tipStyle} formatter={(v, n) => [formatGram(v), n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 6 }}>
        {data.map((d, i) => (
          <div className="kv" key={d.name}>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c.pie[i % c.pie.length], marginRight: 8 }} />{d.name}</span>
            <span className="num">{formatGram(d.grams)} ({total > 0 ? ((d.grams / total) * 100).toFixed(1).replace('.', ',') : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
