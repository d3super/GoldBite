import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Modal } from './ui';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import { RANGES, buildReportData } from '../lib/analytics';
import { saveBlob } from '../lib/files';
import { friendlyError } from '../lib/errors';

const stripInternal = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

export default function ReportModal({ onClose }) {
  const { assets, transactions, prices, alerts, master, priceInputs } = useData();
  const { profile, user, notify } = useApp();
  const [range, setRange] = useState('ALL');
  const [busy, setBusy] = useState(null);

  const run = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        // pdf-lib dimuat hanya saat dibutuhkan agar aplikasi tetap ringan
        const { buildReportPdf, reportFilename } = await import('../lib/report.js');
        const data = buildReportData({ assets, transactions, prices, purities: master.purities, settings: master.settings, priceInputs, profile }, range);
        const bytes = await buildReportPdf(data);
        const r = await saveBlob(new Blob([bytes], { type: 'application/pdf' }), reportFilename());
        if (r !== 'cancelled') notify({ type: 'success', title: 'Laporan siap', message: r === 'shared' ? 'Laporan PDF dibagikan.' : 'Laporan PDF diunduh ke perangkat Anda.' });
      } else {
        const payload = {
          app: 'GOLDBITE', exportedAt: new Date().toISOString(), owner: { username: profile?.username, email: user?.email },
          assets: assets.map(stripInternal), transactions: transactions.map(stripInternal),
          prices: prices.filter((p) => p.user_id === user?.id).map(stripInternal), alerts: alerts.map(stripInternal),
        };
        const name = `goldbite-data-${new Date().toISOString().slice(0, 10)}.json`;
        const r = await saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), name);
        if (r !== 'cancelled') notify({ type: 'success', title: 'Data diekspor', message: 'Salinan data pribadi Anda tersimpan sebagai file JSON.' });
      }
      if (kind === 'pdf') onClose();
    } catch (e) {
      notify({ type: 'error', title: 'Gagal membuat file', message: friendlyError(e) });
    } finally { setBusy(null); }
  };

  return (
    <Modal title="Laporan & ekspor" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Laporan PDF memuat ringkasan, perkembangan portofolio, komposisi, kepemilikan, transaksi, laba terealisasi, dan metode perhitungan.</p>
      <div className="group-title" style={{ marginTop: 0 }}>Periode grafik dan transaksi</div>
      <div className="chips">
        {RANGES.map(([k, l]) => <button key={k} className={`chip ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>)}
      </div>
      <button className="btn btn-gold" onClick={() => run('pdf')} disabled={!!busy}><FileText size={16} /> {busy === 'pdf' ? 'Membuat PDF…' : 'Buat laporan PDF'}</button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => run('json')} disabled={!!busy}><Download size={16} /> {busy === 'json' ? 'Menyiapkan…' : 'Ekspor data pribadi (JSON)'}</button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onClose} disabled={!!busy}>Batal</button>
    </Modal>
  );
}
