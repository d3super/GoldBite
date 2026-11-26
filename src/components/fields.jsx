import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { groupDigits, digitsOf } from '../lib/format';
import { compressImage } from '../lib/image';

// Kolom uang: ketik angka saja, titik ribuan muncul otomatis (tidak ambigu)
export function MoneyField({ label, value, onChange, error, placeholder = '0' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <span className="prefix">Rp</span>
        <input className={`input pre ${error ? 'err' : ''}`} inputMode="numeric" placeholder={placeholder}
          value={groupDigits(value)} onChange={(e) => onChange(digitsOf(e.target.value))} />
      </div>
      {error && <div className="err-text">{error}</div>}
    </label>
  );
}

// Kolom berat/desimal: angka dengan satu pemisah desimal (titik atau koma)
export function DecimalField({ label, value, onChange, error, suffix = 'g', placeholder = '0' }) {
  const clean = (t) => {
    const s = t.replace(/[^\d.,]/g, '');
    const i = s.search(/[.,]/);
    return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/[.,]/g, '');
  };
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input className={`input suf ${error ? 'err' : ''}`} inputMode="decimal" placeholder={placeholder}
          value={value} onChange={(e) => onChange(clean(e.target.value))} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error && <div className="err-text">{error}</div>}
    </label>
  );
}

export function SelectField({ label, value, onChange, options, error }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className={`input ${error ? 'err' : ''}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {error && <div className="err-text">{error}</div>}
    </label>
  );
}

export function DateField({ label, value, onChange, error }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className={`input ${error ? 'err' : ''}`} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <div className="err-text">{error}</div>}
    </label>
  );
}

// Pilih foto dari kamera/galeri; dikompres dulu agar hemat kuota & penyimpanan
export function PhotoField({ label, existingUrl, onBlob, onRemove }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await compressImage(file, 1024, 0.75);
      setPreview(URL.createObjectURL(blob));
      setRemoved(false);
      setErr('');
      onBlob(blob);
    } catch { setErr('Foto tidak dapat dibaca. Coba foto lain.'); }
  };
  const shown = preview || (!removed ? existingUrl : null);

  return (
    <div className="field">
      <span>{label}</span>
      <div className="photo-box" onClick={() => ref.current?.click()}>
        {shown ? <img src={shown} alt="" /> : <div className="photo-empty"><Camera size={22} /> Ambil / pilih foto</div>}
        {shown && (
          <button type="button" className="icon-btn photo-x" aria-label="Hapus foto"
            onClick={(ev) => { ev.stopPropagation(); setPreview(null); setRemoved(true); onBlob(null); onRemove?.(); }}>
            <X size={16} />
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      {err && <div className="err-text">{err}</div>}
    </div>
  );
}
