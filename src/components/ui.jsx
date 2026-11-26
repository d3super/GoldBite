import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

export function Logo({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="GOLDBITE">
      <rect width="512" height="512" rx="112" fill="#142B3B" />
      <polygon points="150,205 362,205 412,275 100,275" fill="#F2D58A" />
      <polygon points="100,275 412,275 412,355 100,355" fill="#D6AE55" />
      <polygon points="100,275 130,275 130,355 100,355" fill="#AA8434" />
      <line x1="165" y1="225" x2="345" y2="225" stroke="#fff" strokeOpacity="0.8" strokeWidth="6" />
      <polygon points="392,134 401,159 426,168 401,177 392,202 383,177 358,168 383,159" fill="#F2D58A" />
    </svg>
  );
}

export function Splash() {
  return (
    <div className="splash">
      <div>
        <Logo size={96} />
        <div className="brand">GOLDBITE</div>
        <div className="tag">Track Your Gold, Grow Your Wealth.</div>
        <div className="spinner" aria-label="Memuat" />
      </div>
    </div>
  );
}

// Modal standar: tombol (x) di kanan atas + tombol Batal. Tutup juga dengan Esc / klik latar.
export function Modal({ title, onClose, children, center = false, hideX = false }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className={`backdrop ${center ? 'center' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${center ? 'center' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {!hideX && (
          <div className="modal-head">
            <h3>{title}</h3>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Pop-up hasil: sukses / gagal
export function ResultModal({ type = 'success', title, message, onClose }) {
  const ok = type === 'success';
  return (
    <Modal center hideX onClose={onClose} title={title}>
      <div className={`result-ico ${ok ? 'success' : 'error'}`}>
        {ok ? <CheckCircle2 size={30} /> : <XCircle size={30} />}
      </div>
      <h3>{title}</h3>
      {message && <p className="muted" style={{ margin: '8px 0 16px' }}>{message}</p>}
      <button type="button" className={`btn ${ok ? 'btn-gold' : ''}`} onClick={onClose} autoFocus>
        {ok ? 'Selesai' : 'Mengerti'}
      </button>
    </Modal>
  );
}

// Dialog konfirmasi (dipakai sebelum menghapus data / keluar)
export function ConfirmModal({ title, message, confirmLabel = 'Ya', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Modal center title={title} onClose={onClose} hideX>
      <h3>{title}</h3>
      <p className="muted" style={{ margin: '8px 0 4px' }}>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Memproses…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Field({ label, type = 'text', value, onChange, error, autoComplete, inputMode, placeholder, maxLength }) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          className={`input ${error ? 'err' : ''}`}
          type={isPw && show ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          maxLength={maxLength}
        />
        {isPw && (
          <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan' : 'Tampilkan'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <div className="err-text">{error}</div>}
    </label>
  );
}
