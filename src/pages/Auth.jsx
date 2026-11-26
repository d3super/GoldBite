import { useRef, useState } from 'react';
import { Camera, ShieldCheck } from 'lucide-react';
import { Logo, Field, Modal } from '../components/ui';
import { useApp } from '../context/AppContext';
import { compressImage } from '../lib/image';
import { friendlyError } from '../lib/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_RE = /^[a-zA-Z0-9_.]{3,30}$/;

export default function Auth() {
  const [mode, setMode] = useState('login'); // login | register | admin
  const [forgot, setForgot] = useState(false);

  return (
    <div className="app bg-aurora">
      <div className="screen" style={{ paddingBottom: 40 }}>
        <div className="auth-top">
          <Logo size={72} />
          <h1>GOLDBITE</h1>
          <p>Track Your Gold, Grow Your Wealth.</p>
        </div>

        {mode !== 'admin' && (
          <div className="seg">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Masuk</button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Daftar</button>
          </div>
        )}

        <div className="card glass">
          {mode === 'register' ? <RegisterForm onDone={() => setMode('login')} /> : (
            <LoginForm admin={mode === 'admin'} onForgot={() => setForgot(true)} />
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          {mode === 'admin' ? (
            <button className="link" onClick={() => setMode('login')}>← Kembali ke login pengguna</button>
          ) : (
            <button className="link" onClick={() => setMode('admin')}>
              <ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Masuk sebagai Super Admin
            </button>
          )}
        </div>
      </div>
      {forgot && <ForgotPassword onClose={() => setForgot(false)} />}
    </div>
  );
}

function LoginForm({ admin, onForgot }) {
  const { login, notify } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!EMAIL_RE.test(email.trim())) er.email = 'Format email tidak valid';
    if (!password) er.password = 'Password wajib diisi';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password, admin ? 'super_admin' : undefined);
    } catch (err) {
      notify({ type: 'error', title: 'Gagal masuk', message: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h3 style={{ marginBottom: 12 }}>{admin ? 'Login Super Admin' : 'Selamat datang kembali'}</h3>
      <Field label="Email" type="email" value={email} onChange={setEmail} error={errs.email} autoComplete="email" inputMode="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} error={errs.password} autoComplete="current-password" />
      <button className="btn btn-gold" disabled={busy}>{busy ? 'Memproses…' : admin ? 'Masuk sebagai Admin' : 'Masuk'}</button>
      {!admin && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" className="link" onClick={onForgot}>Lupa password?</button>
        </div>
      )}
    </form>
  );
}

function RegisterForm({ onDone }) {
  const { register, notify } = useApp();
  const [f, setF] = useState({ fullName: '', username: '', email: '', password: '' });
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b = await compressImage(file);
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch {
      notify({ type: 'error', title: 'Foto gagal dibaca', message: 'Pilih file gambar JPG atau PNG.' });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.fullName.trim().length < 2) er.fullName = 'Nama minimal 2 karakter';
    if (!USER_RE.test(f.username)) er.username = '3–30 karakter: huruf, angka, titik, garis bawah';
    if (!EMAIL_RE.test(f.email.trim())) er.email = 'Format email tidak valid';
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
      er.password = 'Minimal 8 karakter dengan huruf dan angka';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await register({
        email: f.email.trim().toLowerCase(), password: f.password,
        username: f.username, fullName: f.fullName.trim(), avatarBlob: blob,
      });
      if (r.needsConfirm) {
        notify({
          type: 'success', title: 'Akun dibuat',
          message: 'Kami mengirim email konfirmasi. Buka email Anda, klik tautannya, lalu masuk.',
          onClose: onDone,
        });
      } else {
        notify({
          type: 'success', title: 'Pendaftaran berhasil',
          message: r.avatarFailed ? 'Akun dibuat, tetapi foto profil belum terunggah. Coba lagi dari menu Profil.' : 'Selamat datang di GOLDBITE! Buat PIN untuk mengamankan aplikasi.',
        });
      }
    } catch (err) {
      notify({ type: 'error', title: 'Pendaftaran gagal', message: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" className="avatar-pick" onClick={() => fileRef.current?.click()} aria-label="Pilih foto profil">
        {preview ? <img src={preview} alt="Foto profil" /> : <Camera size={26} />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: -6 }}>Foto profil (opsional)</p>
      <Field label="Nama lengkap" value={f.fullName} onChange={set('fullName')} error={errs.fullName} autoComplete="name" />
      <Field label="Username" value={f.username} onChange={set('username')} error={errs.username} autoComplete="username" />
      <Field label="Email" type="email" value={f.email} onChange={set('email')} error={errs.email} autoComplete="email" inputMode="email" />
      <Field label="Password" type="password" value={f.password} onChange={set('password')} error={errs.password} autoComplete="new-password" />
      <button className="btn btn-gold" disabled={busy}>{busy ? 'Mendaftarkan…' : 'Daftar'}</button>
    </form>
  );
}

function ForgotPassword({ onClose }) {
  const { sendReset, notify } = useApp();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setErr('Format email tidak valid'); return; }
    setErr('');
    setBusy(true);
    try {
      const { error } = await sendReset(email.trim().toLowerCase());
      if (error) throw error;
      onClose();
      notify({ type: 'success', title: 'Email terkirim', message: 'Jika email terdaftar, tautan reset password sudah dikirim. Cek juga folder spam.' });
    } catch (e2) {
      notify({ type: 'error', title: 'Gagal mengirim', message: friendlyError(e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Lupa password" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="muted" style={{ marginTop: 0 }}>Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.</p>
        <Field label="Email" type="email" value={email} onChange={setEmail} error={err} autoComplete="email" inputMode="email" />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim tautan'}</button>
        </div>
      </form>
    </Modal>
  );
}
