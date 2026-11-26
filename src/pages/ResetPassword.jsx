import { useState } from 'react';
import { Logo, Field } from '../components/ui';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';

// Tampil setelah pengguna membuka tautan "reset password" dari email
export default function ResetPassword() {
  const { finishRecovery, notify } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) er.pw = 'Minimal 8 karakter dengan huruf dan angka';
    if (pw !== pw2) er.pw2 = 'Konfirmasi password tidak sama';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      notify({ type: 'success', title: 'Password diperbarui', message: 'Password baru sudah aktif.', onClose: finishRecovery });
    } catch (e2) {
      notify({ type: 'error', title: 'Gagal memperbarui', message: friendlyError(e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app bg-aurora">
      <div className="screen">
        <div className="auth-top"><Logo size={64} /><h1>Password baru</h1></div>
        <form className="card glass" onSubmit={submit} noValidate>
          <Field label="Password baru" type="password" value={pw} onChange={setPw} error={err.pw} autoComplete="new-password" />
          <Field label="Ulangi password" type="password" value={pw2} onChange={setPw2} error={err.pw2} autoComplete="new-password" />
          <button className="btn btn-gold" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan password'}</button>
        </form>
      </div>
    </div>
  );
}
