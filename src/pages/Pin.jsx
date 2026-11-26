import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { Logo, Modal, Field } from '../components/ui';
import { useApp } from '../context/AppContext';
import { setPin, verifyPin, MAX_PIN_FAILS } from '../lib/pin';
import { friendlyError } from '../lib/errors';

const LEN = 6;

function PinPad({ title, subtitle, onComplete, shake, disabled }) {
  const [v, setV] = useState('');
  useEffect(() => { if (shake) setV(''); }, [shake]);

  const push = (d) => {
    if (disabled) return;
    const next = (v + d).slice(0, LEN);
    setV(next);
    if (next.length === LEN) setTimeout(() => { onComplete(next); setV(''); }, 120);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <>
      <Logo size={56} />
      <h2 style={{ marginTop: 14 }}>{title}</h2>
      <p className="muted" style={{ margin: '6px 0 0', minHeight: 20 }}>{subtitle}</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} key={shake}>
        {Array.from({ length: LEN }).map((_, i) => <span key={i} className={`pin-dot ${i < v.length ? 'on' : ''}`} />)}
      </div>
      <div className="pin-pad">
        {keys.map((k) => <button key={k} className="pin-key" onClick={() => push(k)}>{k}</button>)}
        <span className="pin-key blank" />
        <button className="pin-key" onClick={() => push('0')}>0</button>
        <button className="pin-key" onClick={() => setV((x) => x.slice(0, -1))} aria-label="Hapus"><Delete size={22} /></button>
      </div>
    </>
  );
}

// Buat PIN baru (2 langkah: buat lalu konfirmasi)
export function PinSetup() {
  const { user, pinCreated, notify } = useApp();
  const [first, setFirst] = useState(null);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState('Pilih 6 angka yang mudah Anda ingat');

  const done = async (pin) => {
    if (!first) { setFirst(pin); setMsg('Masukkan sekali lagi untuk konfirmasi'); return; }
    if (pin !== first) { setFirst(null); setShake((s) => s + 1); setMsg('PIN tidak sama. Ulangi dari awal.'); return; }
    try {
      await setPin(user.id, pin);
      notify({ type: 'success', title: 'PIN aktif', message: 'Mulai sekarang aplikasi dibuka dengan PIN ini di perangkat ini.', onClose: pinCreated });
    } catch {
      notify({ type: 'error', title: 'PIN gagal disimpan', message: 'Peramban ini tidak mendukung penyimpanan aman. Pastikan memakai HTTPS.' });
    }
  };

  return (
    <div className="app bg-aurora">
      <div className="pin-screen">
        <PinPad title={first ? 'Konfirmasi PIN' : 'Buat PIN'} subtitle={msg} onComplete={done} shake={shake} />
      </div>
    </div>
  );
}

// Buka kunci aplikasi
export function PinLock() {
  const { user, profile, unlock, logout, resetPinWithPassword, notify } = useApp();
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState('Masukkan PIN Anda');
  const [forgot, setForgot] = useState(false);

  const done = async (pin) => {
    const r = await verifyPin(user.id, pin);
    if (r.ok) return unlock();
    setShake((s) => s + 1);
    if (r.failsLeft === 0) { setMsg('Terlalu banyak salah. Gunakan "Lupa PIN".'); setForgot(true); }
    else setMsg(`PIN salah. Sisa percobaan: ${r.failsLeft} dari ${MAX_PIN_FAILS}`);
  };

  return (
    <div className="app bg-aurora">
      <div className="pin-screen">
        <PinPad title={`Halo, ${profile?.full_name?.split(' ')[0] || 'Pengguna'}`} subtitle={msg} onComplete={done} shake={shake} />
        <div className="row" style={{ marginTop: 'auto' }}>
          <button className="link" onClick={() => setForgot(true)}>Lupa PIN?</button>
          <button className="link" onClick={logout}>Keluar</button>
        </div>
      </div>
      {forgot && (
        <PasswordGate
          title="Lupa PIN"
          hint="Untuk membuat PIN baru, masukkan password akun Anda (perlu internet)."
          onClose={() => setForgot(false)}
          onSubmit={async (pw) => {
            try { await resetPinWithPassword(pw); }
            catch (e) { notify({ type: 'error', title: 'Gagal', message: friendlyError(e) }); }
          }}
        />
      )}
    </div>
  );
}

// Modal minta password (dipakai Lupa PIN & Ubah PIN)
export function PasswordGate({ title, hint, onSubmit, onClose }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    try { await onSubmit(pw); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
        <Field label="Password" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-gold" disabled={busy || !pw}>{busy ? 'Memeriksa…' : 'Lanjut'}</button>
        </div>
      </form>
    </Modal>
  );
}
