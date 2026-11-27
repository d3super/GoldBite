import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/ui';
import { MoneyField, SelectField } from '../components/fields';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { ALERT_TYPES, alertCurrent } from '../lib/analytics';
import { canNotify, notifyPermission, askNotifyPermission } from '../lib/notify';
import { formatRupiah, formatDateTime } from '../lib/format';
import { friendlyError } from '../lib/errors';

const label = (a) => `${ALERT_TYPES.find((t) => t.id === a.alert_type)?.label ?? 'Nilai'} ${a.direction === 'di_atas' ? '≥' : '≤'} ${formatRupiah(a.target_value)}`;

export default function Notifications({ onBack }) {
  const { alerts, setAlertActive, deleteAlert, markAlertsSeen } = useData();
  const { notify } = useApp();
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(null);
  const [perm, setPerm] = useState(notifyPermission());

  useEffect(() => { markAlertsSeen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = alerts.filter((a) => a.is_active);
  const done = alerts.filter((a) => !a.is_active);

  const enable = async () => {
    const r = await askNotifyPermission();
    setPerm(r);
    if (r === 'denied') notify({ type: 'error', title: 'Izin ditolak', message: 'Aktifkan izin notifikasi untuk GOLDBITE di pengaturan peramban/HP, lalu coba lagi.' });
  };

  const remove = async () => {
    try { await deleteAlert(del); setDel(null); notify({ type: 'success', title: 'Notifikasi dihapus', message: label(del) }); }
    catch (e) { notify({ type: 'error', title: 'Gagal menghapus', message: friendlyError(e) }); }
  };

  return (
    <div className="app bg-aurora">
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="Kembali"><ArrowLeft size={18} /></button>
          <h2 className="page-title" style={{ margin: 0 }}>Notifikasi harga</h2>
          <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Tambah notifikasi"><Plus size={18} /></button>
        </div>

        <div className="card glass">
          <p style={{ margin: 0 }}>Dapatkan pemberitahuan saat harga emas atau nilai portofolio mencapai target Anda.</p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Pengecekan berjalan saat aplikasi dibuka dan setiap harga diperbarui. Notifikasi saat aplikasi tertutup belum didukung.
          </p>
          {canNotify() && perm !== 'granted' && perm !== 'unsupported' && (
            <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={enable} disabled={perm === 'denied'}>
              <Bell size={16} /> {perm === 'denied' ? 'Notifikasi perangkat diblokir' : 'Aktifkan notifikasi perangkat'}
            </button>
          )}
          {perm === 'granted' && <span className="chip ok" style={{ marginTop: 10 }}>Notifikasi perangkat aktif</span>}
        </div>

        <div className="group-title">Aktif</div>
        {active.length ? active.map((a) => (
          <div className="asset-card" key={a.id} style={{ cursor: 'default' }}>
            <span className="thumb"><Bell size={20} /></span>
            <span className="grow"><div className="t">{label(a)}</div><div className="s">Menunggu target tercapai</div></span>
            <button className="icon-btn" onClick={() => setDel(a)} aria-label="Hapus"><Trash2 size={16} /></button>
          </div>
        )) : <p className="muted small">Belum ada notifikasi aktif. Tekan + untuk menambah.</p>}

        {!!done.length && <div className="group-title">Riwayat</div>}
        {done.map((a) => (
          <div className="asset-card" key={a.id} style={{ cursor: 'default' }}>
            <span className="thumb"><Bell size={20} /></span>
            <span className="grow">
              <div className="t">{label(a)}</div>
              <div className="s">{a.triggered_at ? `Tercapai ${formatDateTime(a.triggered_at)}` : 'Dinonaktifkan'}</div>
            </span>
            <button className="icon-btn" onClick={() => setAlertActive(a, true)} aria-label="Aktifkan lagi"><RotateCcw size={16} /></button>
            <button className="icon-btn" style={{ marginLeft: 6 }} onClick={() => setDel(a)} aria-label="Hapus"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>

      {adding && <AddAlert onClose={() => setAdding(false)} />}
      {del && <ConfirmModal title="Hapus notifikasi?" message={label(del)} danger confirmLabel="Hapus" onConfirm={remove} onClose={() => setDel(null)} />}
    </div>
  );
}

function AddAlert({ onClose }) {
  const { saveAlert, priceInputs, summary } = useData();
  const { notify } = useApp();
  const [f, setF] = useState({ alert_type: 'harga_emas', direction: 'di_atas', target: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const cur = alertCurrent(f.alert_type, { priceInputs, summary });

  const submit = async () => {
    setBusy(true);
    try {
      await saveAlert({ alert_type: f.alert_type, direction: f.direction, target_value: Number(f.target || 0) });
      onClose();
      notify({ type: 'success', title: 'Notifikasi tersimpan', message: 'Anda akan diberi tahu saat target tercapai.' });
    } catch (e) {
      if (e.fields) setErr(Object.values(e.fields)[0]);
      else notify({ type: 'error', title: 'Gagal menyimpan', message: friendlyError(e) });
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Tambah notifikasi" onClose={onClose}>
      <SelectField label="Pantau" value={f.alert_type} onChange={set('alert_type')} options={ALERT_TYPES.map((t) => [t.id, t.label])} />
      <SelectField label="Kondisi" value={f.direction} onChange={set('direction')} options={[['di_atas', 'Naik ke atau di atas target'], ['di_bawah', 'Turun ke atau di bawah target']]} />
      <MoneyField label="Target" value={f.target} onChange={set('target')} error={err} />
      <p className="muted small" style={{ marginTop: -4 }}>{cur > 0 ? `Nilai saat ini: ${formatRupiah(cur)}` : 'Nilai saat ini belum tersedia (isi harga di menu Harga).'}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button className="btn btn-gold" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </Modal>
  );
}
