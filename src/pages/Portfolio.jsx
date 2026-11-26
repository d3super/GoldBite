import { useEffect, useState } from 'react';
import { Wallet, Gem, Plus } from 'lucide-react';
import { Modal, ConfirmModal } from '../components/ui';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatGram, formatPercent, formatDate } from '../lib/format';
import { valueAsset, roi } from '../lib/calc';
import { JEWELRY_TYPES } from '../lib/constants';
import { friendlyError } from '../lib/errors';

const BASIS = {
  buyback_kadar: 'harga buyback sesuai kadar',
  estimasi_buyback_24k: 'estimasi dari buyback 24K',
  estimasi_faktor_pasar: 'estimasi dari harga pasar',
  tidak_ada_harga: 'belum ada harga',
};

function useThumb(path, bucket = 'asset-photos') {
  const { fileUrl } = useData();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    if (path) fileUrl(bucket, path).then((u) => alive && setUrl(u)).catch(() => {});
    else setUrl(null);
    return () => { alive = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

function AssetCard({ a, onOpen }) {
  const { master, priceInputs } = useData();
  const url = useThumb(a.photo_path);
  const v = valueAsset(a, priceInputs, master.settings);
  const brand = master.brands.find((b) => b.id === a.brand_id)?.name;
  const jt = JEWELRY_TYPES.find(([k]) => k === a.jewelry_type)?.[1];
  const sold = a.status === 'sold';
  return (
    <button className={`asset-card ${sold ? 'sold' : ''}`} onClick={() => onOpen(a)}>
      <span className="thumb">{url ? <img src={url} alt="" /> : a.category === 'perhiasan' ? <Gem size={22} /> : <Wallet size={22} />}</span>
      <span className="grow">
        <div className="t">{a.name}</div>
        <div className="s">{(a.category === 'perhiasan' ? jt : brand) || '-'} • {a.purity_code} • {formatGram(a.net_weight)}</div>
      </span>
      <span className="r">
        {sold ? <span className="chip">Terjual</span> : v.liquidation == null ? (
          <span className="small muted">Harga belum ada</span>
        ) : (
          <>
            <div className="num">{formatRupiah(v.liquidation)}</div>
            <div className={`small num ${v.unrealizedPL >= 0 ? 'pos' : 'neg'}`}>{v.unrealizedPL >= 0 ? '+' : ''}{formatRupiah(v.unrealizedPL)}</div>
          </>
        )}
      </span>
    </button>
  );
}

export default function Portfolio({ onAdd, onEdit, onSell }) {
  const { assets, summary } = useData();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const list = assets.filter((a) => filter === 'all' || a.category === filter);
  const act = list.filter((a) => a.status !== 'sold');
  const sold = list.filter((a) => a.status === 'sold');
  const current = detail ? assets.find((a) => a.id === detail.id) : null;

  return (
    <>
      <h2 className="page-title">Portfolio</h2>
      <div className="seg three">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Semua</button>
        <button className={filter === 'logam_mulia' ? 'on' : ''} onClick={() => setFilter('logam_mulia')}>Logam mulia</button>
        <button className={filter === 'perhiasan' ? 'on' : ''} onClick={() => setFilter('perhiasan')}>Perhiasan</button>
      </div>

      {!list.length ? (
        <div className="card empty">
          <div className="ico"><Wallet size={28} /></div>
          <b style={{ color: 'var(--text)' }}>Belum ada aset</b>
          <p style={{ margin: '6px 0 14px' }}>Catat emas pertama Anda, cukup beberapa detik.</p>
          <div className="grid2">
            <button className="btn btn-gold" onClick={() => onAdd('logam_mulia')}><Plus size={16} /> Logam mulia</button>
            <button className="btn btn-ghost" onClick={() => onAdd('perhiasan')}><Plus size={16} /> Perhiasan</button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>{summary.itemCount} item aktif • total {formatGram(summary.totalGrams)}</p>
          {act.map((a) => <AssetCard key={a.id} a={a} onOpen={setDetail} />)}
          {!!sold.length && <div className="group-title">Terjual</div>}
          {sold.map((a) => <AssetCard key={a.id} a={a} onOpen={setDetail} />)}
        </>
      )}

      {current && <AssetDetail a={current} onClose={() => setDetail(null)} onEdit={onEdit} onSell={onSell} />}
    </>
  );
}

function AssetDetail({ a, onClose, onEdit, onSell }) {
  const { master, priceInputs, deleteAsset, cancelSale, transactions } = useData();
  const { notify } = useApp();
  const url = useThumb(a.photo_path);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'unsell'
  const [busy, setBusy] = useState(false);
  const v = valueAsset(a, priceInputs, master.settings);
  const brand = master.brands.find((b) => b.id === a.brand_id)?.name;
  const jt = JEWELRY_TYPES.find(([k]) => k === a.jewelry_type)?.[1];
  const sold = a.status === 'sold';
  const sale = sold ? transactions.find((t) => t.asset_id === a.id && t.type === 'jual') : null;
  const holdPL = v.liquidation == null ? null : v.unrealizedPL;

  const run = async (fn, okTitle, okMsg) => {
    setBusy(true);
    try { await fn(); setConfirm(null); onClose(); notify({ type: 'success', title: okTitle, message: okMsg }); }
    catch (e) { notify({ type: 'error', title: 'Gagal', message: friendlyError(e) }); setBusy(false); }
  };

  return (
    <Modal title={a.name} onClose={onClose}>
      <div className="sheet-body">
        {url && <img src={url} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: 190, objectFit: 'cover', marginBottom: 10 }} />}
        <div className="kv"><span>Kategori</span><span>{a.category === 'perhiasan' ? `Perhiasan • ${jt || '-'}` : `Logam mulia • ${brand || '-'}${a.product_type ? ` • ${a.product_type}` : ''}`}</span></div>
        <div className="kv"><span>Kadar</span><span>{a.purity_code}</span></div>
        {a.category === 'perhiasan' && <div className="kv"><span>Berat bruto / batu</span><span className="num">{formatGram(a.gross_weight)} / {formatGram(a.stone_weight)}</span></div>}
        <div className="kv"><span>Berat bersih</span><span className="num">{formatGram(a.net_weight)}</span></div>
        <div className="kv"><span>Berat emas murni</span><span className="num">{formatGram(v.pureGrams)}</span></div>
        <div className="kv"><span>Tanggal beli</span><span>{formatDate(a.purchase_date)}</span></div>
        <div className="kv"><span>Harga beli</span><span className="num">{formatRupiah(a.purchase_price)}</span></div>
        {a.extra_cost > 0 && <div className="kv"><span>Biaya tambahan</span><span className="num">{formatRupiah(a.extra_cost)}</span></div>}
        <div className="kv"><span>Nilai akuisisi</span><b className="num">{formatRupiah(v.acquisition)}</b></div>
        {a.store && <div className="kv"><span>Tempat beli</span><span>{a.store}</span></div>}
        {a.serial_number && <div className="kv"><span>Nomor seri</span><span>{a.serial_number}</span></div>}
        {a.notes && <div className="kv"><span>Catatan</span><span>{a.notes}</span></div>}

        {sold ? (
          <>
            <div className="group-title">Penjualan</div>
            {sale ? (
              <>
                <div className="kv"><span>Tanggal jual</span><span>{formatDate(sale.trx_date)}</span></div>
                <div className="kv"><span>Hasil penjualan</span><span className="num">{formatRupiah(sale.total)}</span></div>
              </>
            ) : <p className="muted small">Data penjualan belum tersedia di perangkat ini.</p>}
          </>
        ) : (
          <>
            <div className="group-title">Nilai saat ini</div>
            <div className="kv"><span>Nilai pasar</span><span className="num">{v.market == null ? 'Harga belum ada' : formatRupiah(v.market)}</span></div>
            <div className="kv"><span>Estimasi nilai jual kembali</span><span className="num">{v.liquidation == null ? 'Harga belum ada' : formatRupiah(v.liquidation)}</span></div>
            {holdPL != null && (
              <>
                <div className="kv"><span>Untung/rugi belum terealisasi</span><b className={`num ${holdPL >= 0 ? 'pos' : 'neg'}`}>{formatRupiah(holdPL)} ({formatPercent(roi(holdPL, v.acquisition))})</b></div>
                <div className="formula">
                  Dihitung dari {BASIS[v.liquidationBasis]}{v.liquidationIsEstimate ? ' — ini estimasi, bukan penawaran resmi toko' : ''}.<br />
                  Untung/rugi = estimasi jual kembali − nilai akuisisi.
                </div>
              </>
            )}
          </>
        )}
      </div>
      <div className="modal-actions" style={{ gridTemplateColumns: sold ? '1fr 1fr' : '1fr 1fr 1fr' }}>
        {sold ? (
          <>
            <button className="btn btn-ghost" onClick={() => setConfirm('unsell')}>Batalkan jual</button>
            <button className="btn btn-ghost" style={{ color: 'var(--neg)' }} onClick={() => setConfirm('delete')}>Hapus</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => { onClose(); onEdit(a); }}>Ubah</button>
            <button className="btn btn-gold" onClick={() => { onClose(); onSell(a); }}>Jual</button>
            <button className="btn btn-ghost" style={{ color: 'var(--neg)' }} onClick={() => setConfirm('delete')}>Hapus</button>
          </>
        )}
      </div>
      {confirm === 'delete' && (
        <ConfirmModal title="Hapus aset?" danger busy={busy} confirmLabel="Hapus"
          message="Aset beserta transaksinya akan dihapus dari portofolio Anda. Tindakan ini tidak dapat dibatalkan."
          onConfirm={() => run(() => deleteAsset(a), 'Aset dihapus', a.name)} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'unsell' && (
        <ConfirmModal title="Batalkan penjualan?" busy={busy} confirmLabel="Batalkan penjualan"
          message="Transaksi penjualan dihapus dan aset kembali aktif di portofolio."
          onConfirm={() => run(() => cancelSale(sale), 'Penjualan dibatalkan', a.name)} onClose={() => setConfirm(null)} />
      )}
    </Modal>
  );
}
