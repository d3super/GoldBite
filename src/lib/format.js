// Format angka Indonesia: titik untuk ribuan, koma untuk desimal
const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export const formatRupiah = (n) => rupiahFmt.format(Math.round(Number(n) || 0)).replace(/\s/g, ' ');

export const formatGram = (n, maxDigits = 4) =>
  `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxDigits }).format(Number(n) || 0)} g`;

export const formatPercent = (n) => {
  const v = Number(n) || 0;
  return `${v > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v)}%`;
};

// "1.250.000,5" -> 1250000.5 ; "12,5" -> 12.5 ; "" -> 0
export function parseId(text) {
  if (typeof text === 'number') return text;
  const clean = String(text ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  const n = Number(clean.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Berat: terima "12,5" dan "12.5" sebagai 12,5 (titik/koma = desimal). "" -> 0
export function parseDecimal(text) {
  if (typeof text === 'number') return text;
  const clean = String(text ?? '').trim().replace(',', '.').replace(/[^\d.]/g, '');
  const parts = clean.split('.');
  const norm = parts.length > 2 ? `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}` : clean;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

// "14000000" -> "14.000.000" (untuk kolom uang yang diketik)
export const groupDigits = (digits) => String(digits || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const digitsOf = (text) => String(text ?? '').replace(/\D/g, '');
export const numToInput = (n) => (n == null ? '' : String(n).replace('.', ','));
export const todayStr = () => {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const formatDate = (s) => {
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const formatDateTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
