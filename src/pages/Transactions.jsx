import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/ui';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatGram, formatDate } from '../lib/format';
import { friendlyError } from '../lib/errors';

export function TxRow({ t, name, onClick }) {
  const buy = t.type === 'beli';
  return (
    <button className="asset-card" onClick={onClick} style={{ boxShadow: 'none' }}>
      <span className="thumb" style={{ color: buy ? 'var(--text)' : 'var(--pos)' }}>{buy ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</span>
      <span className="grow">
        <div className="t">{buy ? 'Pembelian' : 'Penjualan'} • {name}</div>
        <div className="s">{formatDate(t.trx_date)} • {formatGram(t.weight_g)}</div>
      </span>
      <span className="r"><div className={`num ${buy ? '' : 'pos'}`}>{buy ? '−' : '+'}{formatRupiah(t.total)}</div></span>
    </button>
  );
}

export default function Transactions({ onBack }) {
  const { transactions, assets } = useData();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const nameOf = (t) => assets.find((a) => a.id === t.asset_id)?.name ?? 'Aset';
  const list = transactions.filter((t) => filter === 'all' || t.type === filter);

  const groups = [];
  for (const t of list) {
    const k = String(t.trx_date).slice(0, 7);
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [] });
    groups[groups.length - 1].items.push(t);
  }
  const monthLabel = (k) => new Date(`${k}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const cur = detail ? transactions.find((t) => t.id === detail.id) : null;

  return (
    <div className="app bg-aurora">
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="Kembali"><ArrowLeft size={18} /></button>
          <h2 className="page-title" style={{ margin: 0 }}>Transaksi</h2>
          <span style={{ width: 36 }} />
        </div>
        <div className="seg three">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Histori</button>
          <button className={filter === 'beli' ? 'on' : ''} onClick={() => setFilter('beli')}>Pembelian</button>
          <button className={filter === 'jual' ? 'on' : ''} onClick={() => setFilter('jual')}>Penjualan</button>
        </div>
        {!list.length ? (
          <div className="card empty"><b style={{ color: 'var(--text)' }}>Belum ada transaksi</b><p style={{ margin: '6px 0 0' }}>Pembelian tercatat otomatis saat Anda menambah aset. Penjualan dicatat lewat tombol (+).</p></div>
        ) : groups.map((g) => (
          <div key={g.k}>
            <div className="group-title">{monthLabel(g.k)}</div>
            {g.items.map((t) => <TxRow key={t.id} t={t} name={nameOf(t)} onClick={() => setDetail(t)} />)}
          </div>
        ))}
      </div>
      {cur && <TxDetail t={cur} name={nameOf(cur)} onClose={() => setDetail(null)} />}
    </div>
  );
}

function TxDetail({ t, name, onClose }) {
  const { cancelSale, fileUrl } = useData();
  const { notify } = useApp();
  const [img, setImg] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const buy = t.type === 'beli';
  useEffect(() => {
    let alive = true;
    if (t.receipt_path) fileUrl('receipts', t.receipt_path).then((u) => alive && setImg(u)).catch(() => {});
    return () => { alive = false; };
  }, [t.receipt_path]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCancel = async () => {
    setBusy(true);
    try { await cancelSale(t); setConfirm(false); onClose(); notify({ type: 'success', title: 'Penjualan dibatalkan', message: name }); }
    catch (e) { notify({ type: 'error', title: 'Gagal', message: friendlyError(e) }); setBusy(false); }
  };

  return (
    <Modal title={buy ? 'Detail pembelian' : 'Detail penjualan'} onClose={onClose}>
      <div className="sheet-body">
        {img && <img src={img} alt="Bukti transaksi" style={{ width: '100%', borderRadius: 14, maxHeight: 190, objectFit: 'cover', marginBottom: 10 }} />}
        <div className="kv"><span>Aset</span><span>{name}</span></div>
        <div className="kv"><span>Tanggal</span><span>{formatDate(t.trx_date)}</span></div>
        <div className="kv"><span>Berat</span><span className="num">{formatGram(t.weight_g)}</span></div>
        <div className="kv"><span>Harga per gram</span><span className="num">{formatRupiah(t.price_per_g)}</span></div>
        <div className="kv"><span>Total transaksi</span><b className="num">{formatRupiah(t.total)}</b></div>
        {t.extra_cost > 0 && <div className="kv"><span>Biaya tambahan</span><span className="num">{formatRupiah(t.extra_cost)}</span></div>}
        {t.tax > 0 && <div className="kv"><span>Pajak</span><span className="num">{formatRupiah(t.tax)}</span></div>}
        {t.location && <div className="kv"><span>Lokasi</span><span>{t.location}</span></div>}
        {t.notes && <div className="kv"><span>Catatan</span><span>{t.notes}</span></div>}
        {buy && <div className="formula">Pembelian diubah lewat Portfolio → pilih aset → Ubah.</div>}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        {!buy && <button className="btn btn-ghost" style={{ color: 'var(--neg)' }} onClick={() => setConfirm(true)}>Batalkan jual</button>}
      </div>
      {confirm && (
        <ConfirmModal title="Batalkan penjualan?" busy={busy} confirmLabel="Batalkan penjualan"
          message="Transaksi penjualan dihapus dan aset kembali aktif di portofolio."
          onConfirm={doCancel} onClose={() => setConfirm(false)} />
      )}
    </Modal>
  );
}
