import { useState } from 'react';
import { RefreshCw, PencilLine } from 'lucide-react';
import { Modal } from '../components/ui';
import { MoneyField, SelectField } from '../components/fields';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { latestPerKey } from '../lib/prices';
import { PRICE_TYPES } from '../lib/constants';
import { formatRupiah, formatDateTime } from '../lib/format';
import { friendlyError } from '../lib/errors';

const typeLabel = (id) => PRICE_TYPES.find((t) => t.id === id)?.label ?? id;

function nowLocal() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Prices() {
  const { prices, priceInputs, master, refreshSpot, sourceName } = useData();
  const { notify, online } = useApp();
  const [tab, setTab] = useState('market');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);

  const brandName = (id) => master.brands.find((b) => b.id === id)?.name ?? '-';
  const purityCode = (id) => master.purities.find((p) => p.id === id)?.code ?? '-';

  const Row = ({ label, r }) => (
    <div className="price-row">
      <div>
        <div>{label}</div>
        <div className="muted small">{sourceName(r.source_id)} • {formatDateTime(r.effective_at)}</div>
      </div>
      <div className="num">{formatRupiah(r.price_per_gram)}<span className="muted small">/g</span></div>
    </div>
  );
  const Empty = ({ text }) => <p className="muted small" style={{ margin: '8px 0' }}>{text}</p>;

  const byKey = (type, keyFn, labelFn, sortFn) => {
    const m = [...latestPerKey(prices, type, keyFn).entries()];
    if (sortFn) m.sort(sortFn);
    return m.map(([k, r]) => <Row key={`${type}-${k}`} label={labelFn(r)} r={r} />);
  };

  const spot = latestPerKey(prices, 'spot').get('all');
  const doSpot = async () => {
    setBusy(true);
    try {
      const r = await refreshSpot();
      notify({
        type: 'success', title: 'Harga spot diperbarui',
        message: `USD ${r.usdPerOz.toLocaleString('id-ID')} per troy ounce × kurs ${formatRupiah(r.usdIdr)} = ${formatRupiah(r.perGram)} per gram (24K).`,
      });
    } catch (e) {
      notify({ type: 'error', title: 'Gagal memperbarui spot', message: `${friendlyError(e)} Anda tetap bisa memasukkan harga secara manual.` });
    } finally { setBusy(false); }
  };

  const basisText = priceInputs.market24kBasis === 'retail_batangan' ? 'Harga batangan (retail)' : priceInputs.market24kBasis === 'spot' ? 'Harga emas dunia (spot)' : null;
  const sortByPurity = (a, b) => a[0] - b[0];

  return (
    <>
      <h2 className="page-title">Harga Emas</h2>

      <div className="card glass">
        <h3 style={{ marginBottom: 6 }}>Acuan valuasi</h3>
        {priceInputs.market24kRow ? (
          <div className="kv"><span>Nilai pasar memakai</span><span>{basisText}<br /><b className="num">{formatRupiah(priceInputs.market24k)}</b>/g</span></div>
        ) : <Empty text="Belum ada harga. Perbarui spot atau input harga manual agar nilai portofolio bisa dihitung." />}
        {priceInputs.buyback24kRow && <div className="kv"><span>Buyback batangan</span><span><b className="num">{formatRupiah(priceInputs.buyback24k)}</b>/g</span></div>}
        {!!Object.keys(priceInputs.buybackByPurity).length && <div className="kv"><span>Buyback perhiasan</span><span>{Object.keys(priceInputs.buybackByPurity).join(', ')}</span></div>}
        <div className="grid2" style={{ marginTop: 12 }}>
          <button className="btn btn-gold" onClick={doSpot} disabled={busy || !online}><RefreshCw size={16} /> {busy ? 'Memuat…' : 'Perbarui spot'}</button>
          <button className="btn btn-ghost" onClick={() => setManual(true)}><PencilLine size={16} /> Input manual</button>
        </div>
        {!online && <p className="muted small" style={{ marginBottom: 0 }}>Offline: menampilkan harga terakhir yang tersimpan.</p>}
      </div>

      <div className="seg three" style={{ marginTop: 14 }}>
        <button className={tab === 'market' ? 'on' : ''} onClick={() => setTab('market')}>Pasar</button>
        <button className={tab === 'buyback' ? 'on' : ''} onClick={() => setTab('buyback')}>Buyback</button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>Riwayat</button>
      </div>

      <div className="card">
        {tab === 'market' && (
          <>
            <div className="group-title" style={{ marginTop: 0 }}>Emas dunia (spot, 24K)</div>
            {spot ? <Row label="Spot" r={spot} /> : <Empty text="Belum ada harga spot." />}
            <div className="group-title">Batangan per merk</div>
            {byKey('retail_batangan', (r) => r.brand_id, (r) => brandName(r.brand_id)).length
              ? byKey('retail_batangan', (r) => r.brand_id, (r) => brandName(r.brand_id)) : <Empty text="Belum ada harga batangan." />}
            <div className="group-title">Perhiasan per kadar</div>
            {byKey('perhiasan', (r) => r.purity_id, (r) => purityCode(r.purity_id), sortByPurity).length
              ? byKey('perhiasan', (r) => r.purity_id, (r) => purityCode(r.purity_id), sortByPurity) : <Empty text="Belum ada harga perhiasan." />}
          </>
        )}
        {tab === 'buyback' && (
          <>
            <div className="group-title" style={{ marginTop: 0 }}>Buyback batangan per merk</div>
            {byKey('buyback_batangan', (r) => r.brand_id, (r) => brandName(r.brand_id)).length
              ? byKey('buyback_batangan', (r) => r.brand_id, (r) => brandName(r.brand_id)) : <Empty text="Belum ada harga buyback batangan." />}
            <div className="group-title">Buyback perhiasan per kadar</div>
            {byKey('buyback_perhiasan', (r) => r.purity_id, (r) => purityCode(r.purity_id), sortByPurity).length
              ? byKey('buyback_perhiasan', (r) => r.purity_id, (r) => purityCode(r.purity_id), sortByPurity) : <Empty text="Belum ada harga buyback perhiasan." />}
          </>
        )}
        {tab === 'history' && (prices.length ? prices.slice(0, 100).map((r) => (
          <Row key={r.id} label={`${typeLabel(r.price_type)}${r.brand_id ? ` • ${brandName(r.brand_id)}` : ''}${r.purity_id && r.price_type.includes('perhiasan') ? ` • ${purityCode(r.purity_id)}` : ''}`} r={r} />
        )) : <Empty text="Belum ada riwayat harga." />)}
      </div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Harga dari sumber berbeda tidak identik; tiap harga memuat sumber dan waktunya.<br />
        Spot: gold-api.com • Kurs USD/IDR: exchangerate-api.com
      </p>

      {manual && <ManualPrice onClose={() => setManual(false)} />}
    </>
  );
}

function ManualPrice({ onClose }) {
  const { master, addPrice } = useData();
  const { notify } = useApp();
  const p24 = master.purities.find((p) => p.code === '24K') ?? master.purities[0];
  const [f, setF] = useState({
    price_type: 'retail_batangan', brand_id: Number(localStorage.getItem('gb_last_brand')) || master.brands[0]?.id,
    purity_id: master.purities.find((p) => p.code === '18K')?.id ?? p24.id, price: '', at: nowLocal(),
  });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const needs = PRICE_TYPES.find((t) => t.id === f.price_type)?.needs ?? [];

  const submit = async () => {
    setBusy(true);
    try {
      await addPrice({
        price_type: f.price_type,
        brand_id: needs.includes('brand') ? Number(f.brand_id) : null,
        purity_id: needs.includes('purity') ? Number(f.purity_id) : p24.id,
        price_per_gram: Number(f.price || 0),
        effective_at: f.at,
      });
      onClose();
      notify({ type: 'success', title: 'Harga tersimpan', message: `${typeLabel(f.price_type)}: Rp ${Number(f.price).toLocaleString('id-ID')}/g` });
    } catch (e) {
      if (e.fields) setErrs(e.fields);
      else notify({ type: 'error', title: 'Gagal menyimpan', message: friendlyError(e) });
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Input harga manual" onClose={onClose}>
      <div className="sheet-body">
        <SelectField label="Jenis harga" value={f.price_type} onChange={set('price_type')} options={PRICE_TYPES.map((t) => [t.id, t.label])} />
        {needs.includes('brand') && <SelectField label="Merk" value={f.brand_id} onChange={set('brand_id')} options={master.brands.map((b) => [b.id, b.name])} />}
        {needs.includes('purity') && <SelectField label="Kadar" value={f.purity_id} onChange={set('purity_id')} options={master.purities.map((p) => [p.id, p.code])} />}
        <MoneyField label="Harga per gram" value={f.price} onChange={set('price')} error={errs.price_per_gram} />
        <label className="field">
          <span>Waktu berlaku</span>
          <input className={`input ${errs.effective_at ? 'err' : ''}`} type="datetime-local" value={f.at} onChange={(e) => set('at')(e.target.value)} />
          {errs.effective_at && <div className="err-text">{errs.effective_at}</div>}
        </label>
        <p className="muted small">Sumber dicatat sebagai &quot;Input Manual&quot;.</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </Modal>
  );
}
