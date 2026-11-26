import { useMemo, useState } from 'react';
import { Modal, Field } from './ui';
import { MoneyField, SelectField, DateField, PhotoField } from './fields';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatGram, todayStr } from '../lib/format';
import { validateSale } from '../lib/repo';
import { realizedPL, valueAsset } from '../lib/calc';
import { friendlyError } from '../lib/errors';

// Catat penjualan satu aset (seluruh berat aset). Laba/rugi ditampilkan sebelum disimpan.
export default function SellForm({ asset: preset, onClose }) {
  const { assets, transactions, priceInputs, master, sellAsset } = useData();
  const { notify } = useApp();
  const active = assets.filter((a) => a.status !== 'sold');
  const [assetId, setAssetId] = useState(preset?.id ?? active[0]?.id ?? '');
  const [f, setF] = useState({ trx_date: todayStr(), total: '', extra_cost: '', tax: '', location: '', notes: '' });
  const [receipt, setReceipt] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const asset = assets.find((a) => a.id === assetId);

  const estimate = asset ? valueAsset(asset, priceInputs, master.settings).liquidation : null;
  const total = Number(f.total || 0);
  const preview = useMemo(() => {
    if (!asset || !(total > 0)) return null;
    const before = realizedPL(transactions);
    const after = realizedPL([...transactions, {
      type: 'jual', trx_date: f.trx_date, weight_g: asset.net_weight, total, extra_cost: Number(f.extra_cost || 0), tax: Number(f.tax || 0),
    }]);
    return {
      net: total - Number(f.extra_cost || 0) - Number(f.tax || 0),
      cogs: after.cogs - before.cogs,
      pl: after.realizedPL - before.realizedPL,
    };
  }, [asset, transactions, total, f.trx_date, f.extra_cost, f.tax]);

  const submit = async () => {
    const payload = { ...f, total, extra_cost: Number(f.extra_cost || 0), tax: Number(f.tax || 0), receiptBlob: receipt };
    const e = validateSale(asset, payload);
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await sellAsset(asset, payload);
      onClose();
      notify({ type: 'success', title: 'Penjualan tercatat', message: `${asset.name} ditandai terjual.` });
    } catch (err) {
      if (err.fields) setErrs(err.fields);
      else notify({ type: 'error', title: 'Gagal menyimpan', message: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!active.length) {
    return (
      <Modal title="Catat penjualan" onClose={onClose}>
        <p className="muted" style={{ marginTop: 0 }}>Belum ada aset aktif yang bisa dijual. Tambahkan aset terlebih dulu.</p>
        <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
      </Modal>
    );
  }

  return (
    <Modal title="Catat penjualan" onClose={onClose}>
      <div className="sheet-body">
        <SelectField label="Aset yang dijual" value={assetId} onChange={setAssetId} error={errs.asset}
          options={active.map((a) => [a.id, `${a.name} • ${formatGram(a.net_weight)}`])} />
        <MoneyField label="Total hasil penjualan" value={f.total} onChange={set('total')} error={errs.total}
          placeholder={estimate ? String(Math.round(estimate)) : '0'} />
        {estimate != null && <p className="muted small" style={{ marginTop: -6 }}>Estimasi buyback saat ini: {formatRupiah(estimate)} (estimasi, bukan penawaran resmi toko)</p>}
        <DateField label="Tanggal penjualan" value={f.trx_date} onChange={set('trx_date')} error={errs.trx_date} />
        <div className="grid2">
          <MoneyField label="Biaya tambahan" value={f.extra_cost} onChange={set('extra_cost')} error={errs.extra_cost} />
          <MoneyField label="Pajak" value={f.tax} onChange={set('tax')} error={errs.tax} />
        </div>
        <Field label="Lokasi penjualan" value={f.location} onChange={set('location')} />
        <PhotoField label="Bukti transaksi" onBlob={setReceipt} />
        <Field label="Catatan" value={f.notes} onChange={set('notes')} />
        {preview && (
          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="kv"><span>Hasil penjualan bersih</span><span className="num">{formatRupiah(preview.net)}</span></div>
            <div className="kv"><span>Harga pokok (rata-rata tertimbang)</span><span className="num">{formatRupiah(preview.cogs)}</span></div>
            <div className="kv"><span>Laba/rugi terealisasi</span><b className={`num ${preview.pl >= 0 ? 'pos' : 'neg'}`}>{formatRupiah(preview.pl)}</b></div>
            <div className="formula">Laba/rugi = hasil bersih − harga pokok. Harga pokok memakai rata-rata seluruh pembelian emas Anda, bukan hanya harga beli aset ini.</div>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button type="button" className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan penjualan'}</button>
      </div>
    </Modal>
  );
}
