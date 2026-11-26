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
