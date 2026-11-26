import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal, Field } from './ui';
import { MoneyField, DecimalField, SelectField, DateField, PhotoField } from './fields';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { JEWELRY_TYPES, PRODUCT_TYPES } from '../lib/constants';
import { parseDecimal, numToInput, todayStr, formatGram } from '../lib/format';
import { validateAsset } from '../lib/repo';
import { netWeight } from '../lib/calc';
import { friendlyError } from '../lib/errors';

const HIDDEN = ['name', 'purchase_date', 'extra_cost'];

// Satu form untuk logam mulia dan perhiasan. Isian wajib ada di atas (cukup 3-4 isian),
// sisanya ada di "Detail lainnya" dengan nilai awal yang masuk akal.
export default function AssetForm({ category, existing, onClose }) {
  const { master, saveAsset, fileUrl } = useData();
  const { notify } = useApp();
  const isJ = category === 'perhiasan';
  const purityId = (code) => (master.purities.find((p) => p.code === code) ?? master.purities[0]).id;
  const lastBrand = Number(localStorage.getItem('gb_last_brand')) || master.brands[0]?.id;

  const [f, setF] = useState(() => existing ? {
    name: existing.name, brand_id: existing.brand_id ?? lastBrand, product_type: existing.product_type || 'Batangan',
    jewelry_type: existing.jewelry_type || 'cincin', purity_id: existing.purity_id,
    net_weight: numToInput(existing.net_weight), gross_weight: numToInput(existing.gross_weight), stone_weight: numToInput(existing.stone_weight || ''),
    purchase_date: existing.purchase_date, purchase_price: String(Math.round(existing.purchase_price)),
    extra_cost: existing.extra_cost ? String(Math.round(existing.extra_cost)) : '', store: existing.store || '',
    serial_number: existing.serial_number || '', notes: existing.notes || '',
  } : {
    name: '', brand_id: lastBrand, product_type: 'Batangan', jewelry_type: 'cincin', purity_id: purityId(isJ ? '18K' : '24K'),
    net_weight: '', gross_weight: '', stone_weight: '', purchase_date: todayStr(), purchase_price: '', extra_cost: '',
    store: '', serial_number: '', notes: '',
  });
  const [errs, setErrs] = useState({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [existingUrl, setExistingUrl] = useState(null);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    if (existing?.photo_path) fileUrl('asset-photos', existing.photo_path).then((u) => alive && setExistingUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [existing?.photo_path]); // eslint-disable-line react-hooks/exhaustive-deps

  const net = isJ ? netWeight(parseDecimal(f.gross_weight), parseDecimal(f.stone_weight)) : parseDecimal(f.net_weight);

  const submit = async () => {
    const brand = master.brands.find((b) => b.id === Number(f.brand_id));
    const purity = master.purities.find((p) => p.id === Number(f.purity_id));
    const typeLabel = JEWELRY_TYPES.find(([v]) => v === f.jewelry_type)?.[1] ?? 'Perhiasan';
    const name = f.name.trim() || (isJ ? `${typeLabel} ${purity?.code ?? ''}`.trim() : `${brand?.name ?? 'Emas'} ${f.net_weight} g`);
    const payload = {
      category, name, brand_id: Number(f.brand_id), product_type: f.product_type, jewelry_type: f.jewelry_type,
      purity_id: Number(f.purity_id), net_weight: parseDecimal(f.net_weight), gross_weight: parseDecimal(f.gross_weight),
      stone_weight: parseDecimal(f.stone_weight), serial_number: f.serial_number, purchase_date: f.purchase_date,
      purchase_price: Number(f.purchase_price || 0), extra_cost: Number(f.extra_cost || 0), store: f.store, notes: f.notes,
      photoBlob: photo, removePhoto,
    };
    const e = validateAsset(payload);
    setErrs(e);
    if (Object.keys(e).length) { if (HIDDEN.some((k) => e[k])) setOpen(true); return; }
    setBusy(true);
    try {
      await saveAsset(payload, existing);
      if (!isJ) localStorage.setItem('gb_last_brand', String(f.brand_id));
      onClose();
      notify({ type: 'success', title: existing ? 'Aset diperbarui' : 'Aset tersimpan', message: name });
    } catch (err) {
      if (err.fields) setErrs(err.fields);
      else notify({ type: 'error', title: 'Gagal menyimpan', message: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const title = existing ? 'Ubah aset' : isJ ? 'Tambah perhiasan' : 'Tambah logam mulia';
  const purityOpts = master.purities.map((p) => [p.id, p.code]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="sheet-body">
        {isJ ? (
          <>
            <SelectField label="Jenis perhiasan" value={f.jewelry_type} onChange={set('jewelry_type')} options={JEWELRY_TYPES} />
            <div className="grid2">
              <DecimalField label="Berat bruto" value={f.gross_weight} onChange={set('gross_weight')} error={errs.gross_weight} />
              <DecimalField label="Berat batu (jika ada)" value={f.stone_weight} onChange={set('stone_weight')} error={errs.stone_weight} />
            </div>
            <div className="net-box"><span className="muted">Berat bersih emas</span><b className="num">{formatGram(net)}</b></div>
          </>
        ) : (
          <>
            <SelectField label="Merk / produsen" value={f.brand_id} onChange={set('brand_id')} options={master.brands.map((b) => [b.id, b.name])} />
            <DecimalField label="Berat emas" value={f.net_weight} onChange={set('net_weight')} error={errs.net_weight} />
          </>
        )}
        <SelectField label="Kadar" value={f.purity_id} onChange={set('purity_id')} options={purityOpts} error={errs.purity_id} />
        <MoneyField label="Harga beli" value={f.purchase_price} onChange={set('purchase_price')} error={errs.purchase_price} />

        <button type="button" className="link" onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 8px' }}>
          Detail lainnya <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
        {open && (
          <>
            <Field label="Nama / deskripsi (opsional, otomatis bila kosong)" value={f.name} onChange={set('name')} error={errs.name} />
            {!isJ && <SelectField label="Jenis produk" value={f.product_type} onChange={set('product_type')} options={PRODUCT_TYPES.map((x) => [x, x])} />}
            {!isJ && <Field label="Nomor seri (opsional)" value={f.serial_number} onChange={set('serial_number')} />}
            <DateField label="Tanggal pembelian" value={f.purchase_date} onChange={set('purchase_date')} error={errs.purchase_date} />
            <MoneyField label="Biaya tambahan (ongkos, biaya pembuatan)" value={f.extra_cost} onChange={set('extra_cost')} error={errs.extra_cost} />
            <Field label="Tempat pembelian" value={f.store} onChange={set('store')} />
            <PhotoField label={isJ ? 'Foto perhiasan' : 'Foto produk'} existingUrl={existingUrl} onBlob={(b) => { setPhoto(b); if (b) setRemovePhoto(false); }} onRemove={() => setRemovePhoto(true)} />
            <Field label="Catatan" value={f.notes} onChange={set('notes')} />
          </>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button type="button" className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </Modal>
  );
}
