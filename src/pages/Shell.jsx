import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Wallet, Plus, Coins, TrendingUp, Sun, Moon, User, Lock, LogOut, ShieldCheck, Bell, RefreshCw,
  Calculator, FileText, Settings, Cloud, CloudOff, ChevronRight, ArrowLeft, KeyRound, ReceiptText, Gem, HandCoins,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { Modal, ConfirmModal } from '../components/ui';
import AssetForm from '../components/AssetForm';
import SellForm from '../components/SellForm';
import Portfolio from './Portfolio';
import Prices from './Prices';
import Transactions, { TxRow } from './Transactions';
import Analysis from './Analysis';
import Zakat from './Zakat';
import Notifications from './Notifications';
import DashboardCharts from './DashboardCharts';
import ReportModal from '../components/ReportModal';
import { PasswordGate } from './Pin';
import { loadAvatar } from '../lib/image';
import { friendlyError } from '../lib/errors';
import { formatRupiah, formatGram, formatPercent, formatDateTime, parseDecimal, parseId } from '../lib/format';
import { PURITIES } from '../lib/constants';
import { pureWeight, marketValue } from '../lib/calc';

const TABS = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'add', label: '', icon: Plus },
  { id: 'price', label: 'Harga', icon: Coins },
  { id: 'analysis', label: 'Analisis', icon: TrendingUp },
];

export default function Shell() {
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]); // tumpukan halaman penuh: profile, transactions, zakat, notifications
  const overlay = stack[stack.length - 1] ?? null;
  const open = (name) => setStack((st) => [...st, name]);
  const back = () => setStack((st) => st.slice(0, -1));
  const [addOpen, setAddOpen] = useState(false);
  const [assetForm, setAssetForm] = useState(null); // { category, existing }
  const [sellForm, setSellForm] = useState(null); // { asset }
  const { user, profile } = useApp();
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    let alive = true;
    if (user) loadAvatar(user.id, profile?.avatar_path).then((u) => alive && setAvatar(u)).catch(() => {});
    return () => { alive = false; };
  }, [user, profile?.avatar_path]);

  const openAdd = (category) => setAssetForm({ category, existing: null });
  const openEdit = (a) => setAssetForm({ category: a.category, existing: a });
  const openSell = (a) => setSellForm({ asset: a ?? null });

  let body;
  if (overlay === 'profile') body = <ProfilePage avatar={avatar} onBack={back} onOpen={open} />;
  else if (overlay === 'transactions') body = <Transactions onBack={back} />;
  else if (overlay === 'zakat') body = <Zakat onBack={back} />;
  else if (overlay === 'notifications') body = <Notifications onBack={back} />;
  else body = (
    <div className="app bg-aurora">
      <div className="screen">
        {tab === 'home' && <HomeTab avatar={avatar} onProfile={() => open('profile')} onTransactions={() => open('transactions')} onNotifications={() => open('notifications')} />}
        {tab === 'portfolio' && <Portfolio onAdd={openAdd} onEdit={openEdit} onSell={openSell} />}
        {tab === 'price' && <Prices />}
        {tab === 'analysis' && <Analysis />}
      </div>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        <div className="bar glass">
          {TABS.map((t) => {
            const Icon = t.icon;
            if (t.id === 'add') {
              return <button key="add" className="fab" onClick={() => setAddOpen(true)} aria-label="Tambah aset atau catat transaksi"><Icon size={26} /></button>;
            }
            return (
              <button key={t.id} className={`nav-item ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                <Icon size={22} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {body}
      {addOpen && (
        <Modal title="Tambah cepat" onClose={() => setAddOpen(false)}>
          <button className="list-row" onClick={() => { setAddOpen(false); openAdd('logam_mulia'); }}>
            <span className="ico"><Coins size={18} /></span><span className="grow">Tambah logam mulia<div className="muted small">Antam, UBS, Galeri24, dll.</div></span><ChevronRight size={18} className="muted" />
          </button>
          <button className="list-row" onClick={() => { setAddOpen(false); openAdd('perhiasan'); }}>
            <span className="ico"><Gem size={18} /></span><span className="grow">Tambah perhiasan<div className="muted small">Cincin, kalung, gelang, dll.</div></span><ChevronRight size={18} className="muted" />
          </button>
          <button className="list-row" onClick={() => { setAddOpen(false); openSell(null); }}>
            <span className="ico"><HandCoins size={18} /></span><span className="grow">Catat penjualan<div className="muted small">Jual aset yang sudah tercatat</div></span><ChevronRight size={18} className="muted" />
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAddOpen(false)}>Batal</button>
        </Modal>
      )}
      {assetForm && <AssetForm key={assetForm.existing?.id ?? assetForm.category} category={assetForm.category} existing={assetForm.existing} onClose={() => setAssetForm(null)} />}
      {sellForm && <SellForm asset={sellForm.asset} onClose={() => setSellForm(null)} />}
    </>
  );
}

function SyncChip() {
  const { online, session } = useApp();
  const { sync } = useData();
  if (!online) return <span className="chip off"><CloudOff size={14} /> Offline{sync.pending ? ` • ${sync.pending} menunggu` : ''}</span>;
  if (!session) return <span className="chip off"><CloudOff size={14} /> Masuk ulang untuk sinkron</span>;
  if (sync.syncing) return <span className="chip"><RefreshCw size={14} /> Menyinkronkan…</span>;
  if (sync.error) return <span className="chip off"><Cloud size={14} /> Sinkron gagal</span>;
  if (sync.pending) return <span className="chip"><Cloud size={14} /> {sync.pending} menunggu sinkron</span>;
  return <span className="chip ok"><Cloud size={14} /> Tersinkron</span>;
}

function AvatarBtn({ avatar, onClick }) {
  return (
    <button className="avatar" onClick={onClick} aria-label="Buka profil">
      {avatar ? <img src={avatar} alt="" /> : <User size={20} />}
    </button>
  );
}

const SOFT_POS = '#7BE0B8';
const SOFT_NEG = '#FF9B9B';

function HomeTab({ avatar, onProfile, onTransactions, onNotifications }) {
  const { profile, toggleTheme } = useApp();
  const { summary, priceInputs, transactions, assets, ready, unseenAlerts } = useData();
  const dark = document.documentElement.dataset.theme === 'dark';
  const noPrice = summary.itemCount > 0 && !priceInputs.market24k;
  const pl = summary.unrealizedPL;
  const nameOf = (t) => assets.find((a) => a.id === t.asset_id)?.name ?? 'Aset';

  return (
    <>
      <div className="topbar">
        <div>
          <div className="hello">Selamat datang,</div>
          <div className="name">{profile?.full_name || 'Pengguna'}</div>
        </div>
        <div className="row">
          <button className="icon-btn" onClick={onNotifications} aria-label="Notifikasi harga" style={{ position: 'relative' }}>
            <Bell size={18} />
            {unseenAlerts > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--neg)', color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unseenAlerts}</span>}
          </button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <AvatarBtn avatar={avatar} onClick={onProfile} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}><SyncChip /></div>

      <div className="hero">
        <div className="label">Total nilai portofolio</div>
        <div className="big num">{!ready ? '…' : noPrice ? 'Harga belum ada' : formatRupiah(summary.marketValue)}</div>
        <div className="stat-row">
          <div className="stat"><div className="label">Total modal</div><div className="val num">{formatRupiah(summary.capital)}</div></div>
          <div className="stat"><div className="label">Est. jual kembali</div><div className="val num">{noPrice ? '-' : formatRupiah(summary.liquidationValue)}</div></div>
          <div className="stat"><div className="label">Untung/rugi</div><div className="val num" style={{ color: noPrice ? undefined : pl >= 0 ? SOFT_POS : SOFT_NEG }}>{noPrice ? '-' : formatRupiah(pl)}</div></div>
          <div className="stat"><div className="label">Return</div><div className="val num" style={{ color: noPrice ? undefined : pl >= 0 ? SOFT_POS : SOFT_NEG }}>{noPrice ? '-' : formatPercent(summary.roiPercent)}</div></div>
          <div className="stat"><div className="label">Total berat</div><div className="val num">{formatGram(summary.totalGrams)}</div></div>
          <div className="stat"><div className="label">Jumlah item</div><div className="val num">{summary.itemCount}</div></div>
        </div>
        <div className="small" style={{ marginTop: 10, color: 'rgba(255,255,255,0.7)', position: 'relative', zIndex: 1 }}>
          Logam mulia {formatGram(summary.gramsByCategory.logam_mulia)} • Perhiasan {formatGram(summary.gramsByCategory.perhiasan)}
          {noPrice && <><br />Isi harga di menu Harga agar nilai portofolio bisa dihitung.</>}
          {!noPrice && summary.itemCount > 0 && summary.liquidationIsEstimate && <><br />Nilai jual kembali adalah estimasi, bukan penawaran resmi toko.</>}
          {!noPrice && !summary.isComplete && summary.itemCount > 0 && <><br />Sebagian aset belum memiliki harga acuan.</>}
        </div>
      </div>

      <DashboardCharts />

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>Transaksi terakhir</h3>
          <button className="link" onClick={onTransactions}>Lihat semua</button>
        </div>
        {transactions.length ? transactions.slice(0, 3).map((t) => <TxRow key={t.id} t={t} name={nameOf(t)} onClick={onTransactions} />)
          : <p className="muted small" style={{ margin: '6px 0' }}>Belum ada transaksi. Tekan tombol (+) untuk menambah aset.</p>}
      </div>

      <QuickCalc />
    </>
  );
}

// Kalkulator cepat: contoh perhitungan yang bisa diperiksa langsung ("setiap perhitungan dapat diperiksa")
function QuickCalc() {
  const [weight, setWeight] = useState('10');
  const [code, setCode] = useState('18K');
  const [price, setPrice] = useState('1500000');
  const p = PURITIES.find((x) => x.code === code);
  const w = parseDecimal(weight);
  const pr = parseId(price);
  const pure = pureWeight(w, p.fineness);
  const val = marketValue(w, pr, p.fineness);
  const pct = `${(p.fineness * 100).toFixed(2).replace('.', ',')}%`;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3 style={{ marginBottom: 10 }}>Kalkulator cepat</h3>
      <div className="grid2">
        <label className="field"><span>Berat bersih (g)</span>
          <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label className="field"><span>Kadar</span>
          <select className="input" value={code} onChange={(e) => setCode(e.target.value)}>
            {PURITIES.map((x) => <option key={x.code} value={x.code}>{x.code} ({(x.fineness * 100).toFixed(2).replace('.', ',')}%)</option>)}
          </select></label>
      </div>
      <label className="field"><span>Harga emas 24K per gram (Rp)</span>
        <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      <div className="grid2">
        <div><div className="muted small">Berat emas murni</div><div className="num" style={{ fontSize: 17 }}>{formatGram(pure)}</div></div>
        <div><div className="muted small">Nilai emas</div><div className="num" style={{ fontSize: 17 }}>{formatRupiah(val)}</div></div>
      </div>
      <div className="formula">
        Berat murni = {w} g × {pct} = {formatGram(pure)}<br />
        Nilai = {w} g × {formatRupiah(pr)} × {pct} = {formatRupiah(val)}
      </div>
    </div>
  );
}

function SyncModal({ onClose }) {
  const { online, session } = useApp();
  const { sync, syncNow } = useData();
  const canSync = online && !!session && !sync.syncing;
  return (
    <Modal title="Sinkronisasi" onClose={onClose}>
      <div className="kv"><span>Koneksi</span><span>{online ? 'Online' : 'Offline'}</span></div>
      <div className="kv"><span>Menunggu dikirim</span><span className="num">{sync.pending} data</span></div>
      <div className="kv"><span>Terakhir berhasil</span><span>{sync.lastSync ? formatDateTime(sync.lastSync) : 'Belum pernah'}</span></div>
      {sync.error && <div className="formula" style={{ color: 'var(--neg)' }}>{sync.error}</div>}
      {!session && <p className="muted small">Sesi login habis. Keluar lalu masuk lagi saat online agar data bisa disinkronkan.</p>}
      <p className="muted small">Data selalu disimpan lebih dulu di perangkat ini, sehingga tetap bisa dicatat saat offline dan terkirim otomatis saat koneksi kembali.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        <button className="btn btn-gold" onClick={syncNow} disabled={!canSync}>{sync.syncing ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}</button>
      </div>
    </Modal>
  );
}

function ProfilePage({ avatar, onBack, onOpen }) {
  const { user, profile, theme, setTheme, online, lockNow, hasPin, logout, resetPinWithPassword, notify } = useApp();
  const { sync } = useData();
  const [confirmOut, setConfirmOut] = useState(false);
  const [outBusy, setOutBusy] = useState(false);
  const [changePin, setChangePin] = useState(false);
  const [account, setAccount] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [soon, setSoon] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);

  const doLogout = async () => {
    setOutBusy(true);
    try { await logout(); } catch (e) { notify({ type: 'error', title: 'Gagal keluar', message: friendlyError(e) }); setOutBusy(false); }
  };

  const Row = ({ icon: Icon, label, sub, onClick }) => (
    <button className="list-row" onClick={onClick}>
      <span className="ico"><Icon size={18} /></span>
      <span className="grow"><div>{label}</div>{sub && <div className="muted small">{sub}</div>}</span>
      <ChevronRight size={18} className="muted" />
    </button>
  );

  return (
    <div className="app bg-aurora">
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={onBack} aria-label="Kembali"><ArrowLeft size={18} /></button>
          <h2 className="page-title" style={{ margin: 0 }}>Profil</h2>
          <span style={{ width: 36 }} />
        </div>

        <div className="card glass" style={{ textAlign: 'center' }}>
          <div className="avatar" style={{ width: 84, height: 84, margin: '0 auto 10px' }}>
            {avatar ? <img src={avatar} alt="" /> : <User size={34} />}
          </div>
          <h3>{profile?.full_name}</h3>
          <div className="muted">@{profile?.username}</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <span className="chip">{profile?.role === 'super_admin' ? 'Super Admin' : 'Pengguna'}</span>
            {online ? <span className="chip ok"><Cloud size={14} /> Online</span> : <span className="chip off"><CloudOff size={14} /> Offline</span>}
          </div>
        </div>

        <div className="card" style={{ marginTop: 14, padding: '4px 14px' }}>
          <Row icon={User} label="Akun saya" sub="Nama, username, email" onClick={() => setAccount(true)} />
          <Row icon={ReceiptText} label="Transaksi" sub="Histori pembelian dan penjualan" onClick={() => onOpen('transactions')} />
          <Row icon={RefreshCw} label="Sinkronisasi" sub={sync.pending ? `${sync.pending} data menunggu` : 'Semua data tersinkron'} onClick={() => setSyncOpen(true)} />
          <Row icon={KeyRound} label="Ubah PIN" sub="Butuh password akun" onClick={() => setChangePin(true)} />
          {hasPin && <Row icon={Lock} label="Kunci aplikasi sekarang" onClick={lockNow} />}
          <Row icon={Bell} label="Notifikasi harga" sub="Pantau target harga dan nilai portofolio" onClick={() => onOpen('notifications')} />
          <Row icon={Calculator} label="Kalkulator Zakat" sub="Zakat mal emas dan simulasi" onClick={() => onOpen('zakat')} />
          <Row icon={FileText} label="Laporan & ekspor" sub="Laporan PDF dan ekspor data" onClick={() => setReportOpen(true)} />
          <Row icon={Settings} label="Tampilan" sub={theme === 'system' ? 'Ikuti sistem' : theme === 'dark' ? 'Mode gelap' : 'Mode terang'} onClick={() => setThemeOpen(true)} />
          {profile?.role === 'super_admin' && <Row icon={ShieldCheck} label="Panel Super Admin" sub="Segera hadir (Fase 5)" onClick={() => setSoon('Panel Super Admin')} />}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 14, color: 'var(--neg)' }} onClick={() => setConfirmOut(true)}>
          <LogOut size={18} /> Keluar
        </button>
      </div>

      {syncOpen && <SyncModal onClose={() => setSyncOpen(false)} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
      {confirmOut && (
        <ConfirmModal title="Keluar dari akun?" message="Data tetap aman di server dan di perangkat ini. Anda perlu memasukkan email dan password lagi untuk masuk." confirmLabel="Keluar" danger busy={outBusy}
          onConfirm={doLogout} onClose={() => setConfirmOut(false)} />
      )}
      {changePin && (
        <PasswordGate title="Ubah PIN" hint="Masukkan password akun untuk membuat PIN baru (perlu internet)."
          onClose={() => setChangePin(false)}
          onSubmit={async (pw) => {
            try { await resetPinWithPassword(pw); setChangePin(false); }
            catch (e) { notify({ type: 'error', title: 'Gagal', message: friendlyError(e) }); }
          }} />
      )}
      {account && (
        <Modal title="Akun saya" onClose={() => setAccount(false)}>
          <div className="kv"><span>Nama</span><span>{profile?.full_name}</span></div>
          <div className="kv"><span>Username</span><span>@{profile?.username}</span></div>
          <div className="kv"><span>Email</span><span>{user?.email || '-'}</span></div>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAccount(false)}>Tutup</button>
        </Modal>
      )}
      {themeOpen && (
        <Modal title="Tampilan" onClose={() => setThemeOpen(false)}>
          {[['light', 'Mode terang'], ['dark', 'Mode gelap'], ['system', 'Ikuti sistem']].map(([id, label]) => (
            <button key={id} className="list-row" onClick={() => { setTheme(id); setThemeOpen(false); }}>
              <span className="grow">{label}</span>{theme === id && <span className="chip ok">Aktif</span>}
            </button>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setThemeOpen(false)}>Batal</button>
        </Modal>
      )}
      {soon && (
        <Modal title={soon} onClose={() => setSoon(null)}>
          <p className="muted" style={{ marginTop: 0 }}>Fitur ini sedang disiapkan dan akan aktif pada fase pengembangan berikutnya.</p>
          <button className="btn btn-ghost" onClick={() => setSoon(null)}>Tutup</button>
        </Modal>
      )}
    </div>
  );
}
