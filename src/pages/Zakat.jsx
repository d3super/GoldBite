import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MoneyField, DecimalField } from '../components/fields';
import { useData } from '../context/DataContext';
import { zakatMal, pureWeight } from '../lib/calc';
import { haulPureGrams } from '../lib/analytics';
import { formatRupiah, formatGram, parseDecimal } from '../lib/format';

export default function Zakat({ onBack }) {
  const { assets, priceInputs, master } = useData();
  const active = useMemo(() => assets.filter((a) => a.status !== 'sold'), [assets]);
  const [tab, setTab] = useState('calc');
  const [price, setPrice] = useState(priceInputs.market24k ? String(Math.round(priceInputs.market24k)) : '');
  const [withJewelry, setWithJewelry] = useState(true);
  const [haulOverride, setHaulOverride] = useState(null); // null = otomatis dari tanggal beli
  const [simGrams, setSimGrams] = useState('');
  const [simHaul, setSimHaul] = useState(true);

  const counted = withJewelry ? active : active.filter((a) => a.category !== 'perhiasan');
  const pure = counted.reduce((t, a) => t + pureWeight(a.net_weight, a.fineness), 0);
  const nisabGrams = master.settings.zakat_nisab_grams;
  const haulGrams = haulPureGrams(counted);
  const autoHaul = haulGrams >= nisabGrams;
  const haul = haulOverride ?? autoHaul;

  const p = Number(price || 0);
  const calc = zakatMal({ totalPureGrams: pure, price24k: p, haulMet: haul, settings: master.settings });
  const sim = zakatMal({ totalPureGrams: parseDecimal(simGrams), price24k: p, haulMet: simHaul, settings: master.settings });
  const view = tab === 'calc' ? calc : sim;
  const gram = tab === 'calc' ? pure : parseDecimal(simGrams);
  const missing = Math.max(0, nisabGrams - gram);

  return (
    <div className="app bg-aurora">
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="Kembali"><ArrowLeft size={18} /></button>
          <h2 className="page-title" style={{ margin: 0 }}>Kalkulator Zakat</h2>
          <span style={{ width: 36 }} />
        </div>

        <div className="seg">
          <button className={tab === 'calc' ? 'on' : ''} onClick={() => setTab('calc')}>Zakat mal emas</button>
          <button className={tab === 'sim' ? 'on' : ''} onClick={() => setTab('sim')}>Simulasi</button>
        </div>

        <div className="card">
          <MoneyField label="Harga emas murni (24K) per gram" value={price} onChange={setPrice} />
          {!priceInputs.market24k && <p className="muted small" style={{ marginTop: -4 }}>Belum ada harga tersimpan. Isi harga di sini, atau perbarui di menu Harga.</p>}

          {tab === 'calc' ? (
            <>
              <div className="kv"><span>Emas murni dihitung</span><span className="num">{formatGram(pure)}</span></div>
              <label className="row" style={{ padding: '10px 0' }}>
                <input type="checkbox" checked={withJewelry} onChange={(e) => setWithJewelry(e.target.checked)} />
                <span>Sertakan perhiasan</span>
              </label>
              <p className="muted small" style={{ marginTop: -4 }}>Ulama berbeda pendapat soal perhiasan yang dipakai sehari-hari. Sesuaikan dengan pandangan yang Anda ikuti atau tanyakan ke lembaga zakat.</p>
              <label className="row" style={{ padding: '6px 0' }}>
                <input type="checkbox" checked={haul} onChange={(e) => setHaulOverride(e.target.checked)} />
                <span>Sudah dimiliki 1 tahun (haul)</span>
              </label>
              <p className="muted small" style={{ marginTop: 0 }}>
                Emas murni yang sudah dimiliki lebih dari 354 hari (1 tahun hijriah) menurut tanggal beli: {formatGram(haulGrams)}.
                {haulOverride != null && <> Anda mengubah isian ini secara manual. <button className="link" onClick={() => setHaulOverride(null)}>Kembalikan otomatis</button></>}
              </p>
            </>
          ) : (
            <>
              <DecimalField label="Jumlah emas murni (simulasi)" value={simGrams} onChange={setSimGrams} />
              <button className="link" style={{ margin: '-6px 0 8px' }} onClick={() => setSimGrams(String(pure).replace('.', ','))}>Isi dari portofolio saya ({formatGram(pure)})</button>
              <label className="row" style={{ padding: '6px 0' }}>
                <input type="checkbox" checked={simHaul} onChange={(e) => setSimHaul(e.target.checked)} />
                <span>Anggap sudah 1 tahun (haul)</span>
              </label>
            </>
          )}
        </div>

        <div className="card glass" style={{ marginTop: 14 }}>
          <div className="muted small">Zakat yang harus dikeluarkan</div>
          <div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{p > 0 ? formatRupiah(view.zakat) : '-'}</div>
          <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <span className={`chip ${view.reachedNisab ? 'ok' : 'off'}`}>{view.reachedNisab ? 'Mencapai nisab' : 'Belum mencapai nisab'}</span>
            <span className={`chip ${view.haulMet ? 'ok' : 'off'}`}>{view.haulMet ? 'Sudah haul' : 'Belum haul'}</span>
          </div>
          <div className="kv" style={{ marginTop: 10 }}><span>Nisab ({nisabGrams} g emas murni)</span><span className="num">{p > 0 ? formatRupiah(view.nisab) : '-'}</span></div>
          <div className="kv"><span>Emas murni dimiliki</span><span className="num">{formatGram(gram)}</span></div>
          <div className="kv"><span>Basis zakat (nilai emas murni)</span><span className="num">{p > 0 ? formatRupiah(view.base) : '-'}</span></div>
          {!view.reachedNisab && gram > 0 && <div className="kv"><span>Kurang untuk mencapai nisab</span><span className="num">{formatGram(missing)}</span></div>}
          <div className="formula">
            Nisab = {nisabGrams} gram × harga emas murni.<br />
            Basis zakat = emas murni × harga emas murni.<br />
            Zakat = basis × {String(master.settings.zakat_rate * 100).replace('.', ',')}% (bila mencapai nisab dan sudah haul).
          </div>
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}>
          Alat bantu hitung, bukan fatwa. Perhitungan hanya mencakup emas yang tercatat di GOLDBITE.
        </p>
      </div>
    </div>
  );
}
