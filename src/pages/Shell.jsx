import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Wallet, Plus, Coins, TrendingUp, Sun, Moon, User, Lock, LogOut, ShieldCheck,
  Bell, RefreshCw, Calculator, FileText, Settings, Cloud, CloudOff, ChevronRight, ArrowLeft, KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal, ConfirmModal } from '../components/ui';
import { PasswordGate } from './Pin';
import { loadAvatar } from '../lib/image';
import { friendlyError } from '../lib/errors';
import { formatRupiah, formatGram, formatPercent, parseId } from '../lib/format';
import { PURITIES } from '../lib/constants';
import { summarizePortfolio, pureWeight, marketValue } from '../lib/calc';

const TABS = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'add', label: '', icon: Plus },
  { id: 'price', label: 'Harga', icon: Coins },
  { id: 'analysis', label: 'Analisis', icon: TrendingUp },
];

export default function Shell() {
  const [tab, setTab] = useState('home');
  const [profileOpen, setProfileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { user, profile } = useApp();
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    let alive = true;
    if (user) loadAvatar(user.id, profile?.avatar_path).then((u) => alive && setAvatar(u)).catch(() => {});
    return () => { alive = false; };
  }, [user, profile?.avatar_path]);

  if (profileOpen) return <ProfilePage avatar={avatar} onBack={() => setProfileOpen(false)} />;

  return (
    <div className="app bg-aurora">
      <div className="screen">
        {tab === 'home' && <HomeTab avatar={avatar} onProfile={() => setProfileOpen(true)} />}
        {tab === 'portfolio' && <Soon title="Portfolio" text="Daftar semua aset, logam mulia, dan perhiasan akan hadir di Fase 3." icon={Wallet} />}
        {tab === 'price' && <Soon title="Harga Emas" text="Harga pasar, buyback, dan riwayat harga akan hadir di Fase 3." icon={Coins} />}
        {tab === 'analysis' && <Soon title="Analisis" text="Profit/loss, ROI, komposisi, dan valuasi akan hadir di Fase 4." icon={TrendingUp} />}
      </div>

      <nav className="bottom-nav" aria-label="Navigasi utama">
        <div className="bar glass">
          {TABS.map((t) => {
            const Icon = t.icon;
            if (t.id === 'add') {
              return <button key="add" className="fab" onClick={() => setAddOpen(true)} aria-label="Tambah aset atau transaksi"><Icon size={26} /></button>;
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

      {addOpen && (
        <Modal title="Tambah cepat" onClose={() => setAddOpen(false)}>
          <p className="muted" style={{ marginTop: 0 }}>
            Pintasan ini akan membuka form <b>Tambah aset</b> dan <b>Catat transaksi</b> (maksimal 3 langkah). Form tersebut dibuat di Fase 3.
          </p>
          <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Tutup</button>
        </Modal>
      )}
    </div>
  );
}

function Soon({ title, text, icon: Icon }) {
  return (
    <>
      <h2 className="page-title">{title}</h2>
      <div className="card empty">
        <div className="ico"><Icon size={28} /></div>
        <b style={{ color: 'var(--text)' }}>Segera hadir</b>
        <p style={{ margin: '6px 0 0' }}>{text}</p>
      </div>
    </>
  );
}

function StatusChip() {
  const { online } = useApp();
  return online
    ? <span className="chip ok"><Cloud size={14} /> Online</span>
    : <span className="chip off"><CloudOff size={14} /> Offline</span>;
}

function AvatarBtn({ avatar, onClick }) {
  return (
    <button className="avatar" onClick={onClick} aria-label="Buka profil">
      {avatar ? <img src={avatar} alt="" /> : <User size={20} />}
    </button>
  );
}

function HomeTab({ avatar, onProfile }) {
  const { profile, toggleTheme } = useApp();
  // Menunjukkan Calculation Engine terhubung. Data aset nyata hadir di Fase 3.
  const s = summarizePortfolio([], {});
  const dark = document.documentElement.dataset.theme === 'dark';

  return (
    <>
      <div className="topbar">
        <div>
          <div className="hello">Selamat datang,</div>
          <div className="name">{profile?.full_name || 'Pengguna'}</div>
        </div>
        <div className="row">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Ganti tema">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <AvatarBtn avatar={avatar} onClick={onProfile} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}><StatusChip /></div>

      <div className="hero">
        <div className="label">Total nilai portofolio</div>
        <div className="big num">{formatRupiah(s.marketValue)}</div>
        <div className="stat-row">
          <div className="stat"><div className="label">Total modal</div><div className="val num">{formatRupiah(s.capital)}</div></div>
          <div className="stat"><div className="label">Return</div><div className="val num">{formatPercent(s.roiPercent)}</div></div>
          <div className="stat"><div className="label">Total berat</div><div className="val num">{formatGram(s.totalGrams)}</div></div>
          <div className="stat"><div className="label">Jumlah item</div><div className="val num">{s.itemCount}</div></div>
        </div>
      </div>

      <QuickCalc />
    </>
  );
}

// Kalkulator cepat: contoh perhitungan yang bisa diperiksa langsung (prinsip "setiap perhitungan dapat diperiksa")
function QuickCalc() {
  const [weight, setWeight] = useState('10');
  const [code, setCode] = useState('18K');
  const [price, setPrice] = useState('1500000');
  const p = PURITIES.find((x) => x.code === code);
  const w = parseId(weight);
  const pr = parseId(price);
  const pure = pureWeight(w, p.fineness);
  const val = marketValue(w, pr, p.fineness);

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
        <div><div className="muted" style={{ fontSize: 12 }}>Berat emas murni</div><div className="num" style={{ fontSize: 17 }}>{formatGram(pure)}</div></div>
        <div><div className="muted" style={{ fontSize: 12 }}>Nilai emas</div><div className="num" style={{ fontSize: 17 }}>{formatRupiah(val)}</div></div>
      </div>
      <div className="formula">
        Berat murni = {w} g × {(p.fineness * 100).toFixed(2).replace('.', ',')}% = {formatGram(pure)}<br />
        Nilai = {w} g × {formatRupiah(pr)} × {(p.fineness * 100).toFixed(2).replace('.', ',')}% = {formatRupiah(val)}
      </div>
    </div>
  );
}

function ProfilePage({ avatar, onBack }) {
  const { user, profile, theme, setTheme, online, lockNow, hasPin, logout, resetPinWithPassword, notify } = useApp();
  const [confirmOut, setConfirmOut] = useState(false);
  const [outBusy, setOutBusy] = useState(false);
  const [changePin, setChangePin] = useState(false);
  const [account, setAccount] = useState(false);
  const [soon, setSoon] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);

  const doLogout = async () => {
    setOutBusy(true);
    try { await logout(); } catch (e) { notify({ type: 'error', title: 'Gagal keluar', message: friendlyError(e) }); setOutBusy(false); }
  };

  const Row = ({ icon: Icon, label, sub, onClick }) => (
    <button className="list-row" onClick={onClick}>
      <span className="ico"><Icon size={18} /></span>
      <span className="grow"><div>{label}</div>{sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}</span>
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
          <Row icon={KeyRound} label="Ubah PIN" sub="Butuh password akun" onClick={() => setChangePin(true)} />
          {hasPin && <Row icon={Lock} label="Kunci aplikasi sekarang" onClick={lockNow} />}
          <Row icon={RefreshCw} label="Sinkronisasi" sub="Segera hadir (Fase 5)" onClick={() => setSoon('Sinkronisasi')} />
          <Row icon={Bell} label="Notifikasi" sub="Segera hadir (Fase 4)" onClick={() => setSoon('Notifikasi')} />
          <Row icon={Calculator} label="Kalkulator Zakat" sub="Segera hadir (Fase 4)" onClick={() => setSoon('Kalkulator Zakat')} />
          <Row icon={FileText} label="Laporan & ekspor" sub="Segera hadir (Fase 4)" onClick={() => setSoon('Laporan & ekspor')} />
          <Row icon={Settings} label="Tampilan" sub={theme === 'system' ? 'Ikuti sistem' : theme === 'dark' ? 'Mode gelap' : 'Mode terang'} onClick={() => setThemeOpen(true)} />
          {profile?.role === 'super_admin' && <Row icon={ShieldCheck} label="Panel Super Admin" sub="Segera hadir (Fase 5)" onClick={() => setSoon('Panel Super Admin')} />}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 14, color: 'var(--neg)' }} onClick={() => setConfirmOut(true)}>
          <LogOut size={18} /> Keluar
        </button>
      </div>

      {confirmOut && (
        <ConfirmModal title="Keluar dari akun?" message="Anda perlu memasukkan email dan password lagi untuk masuk." confirmLabel="Keluar" danger busy={outBusy}
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
          <div className="list-row"><span className="grow"><div className="muted" style={{ fontSize: 12 }}>Nama</div>{profile?.full_name}</span></div>
          <div className="list-row"><span className="grow"><div className="muted" style={{ fontSize: 12 }}>Username</div>@{profile?.username}</span></div>
          <div className="list-row"><span className="grow"><div className="muted" style={{ fontSize: 12 }}>Email</div>{user?.email || '-'}</span></div>
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
