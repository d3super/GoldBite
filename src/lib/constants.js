// Data awal ini harus sama dengan isi tabel di goldbite-schema.sql (urutan id = urutan insert).
// Dipakai sebagai cadangan saat aplikasi belum pernah online; setelah sinkronisasi, data server yang dipakai.
export const PURITIES = [
  { id: 1, code: '24K', fineness: 0.9999 },
  { id: 2, code: '23K', fineness: 0.9583 },
  { id: 3, code: '22K', fineness: 0.9167 },
  { id: 4, code: '20K', fineness: 0.8333 },
  { id: 5, code: '18K', fineness: 0.75 },
  { id: 6, code: '17K', fineness: 0.708 },
  { id: 7, code: '16K', fineness: 0.667 },
  { id: 8, code: '9K', fineness: 0.375 },
];

export const BRANDS = [
  { id: 1, name: 'Antam' },
  { id: 2, name: 'UBS' },
  { id: 3, name: 'Hartadinata' },
  { id: 4, name: 'Galeri24' },
  { id: 5, name: 'Lotus Archi' },
  { id: 6, name: 'Merk Lainnya' },
];

export const SOURCES = [
  { id: 1, name: 'API Harga Spot', kind: 'api' },
  { id: 2, name: 'Input Manual', kind: 'manual' },
];

export const JEWELRY_TYPES = [
  ['cincin', 'Cincin'], ['kalung', 'Kalung'], ['gelang', 'Gelang'], ['anting', 'Anting'],
  ['liontin', 'Liontin'], ['gelang_kaki', 'Gelang kaki'], ['lainnya', 'Perhiasan lainnya'],
];

export const PRODUCT_TYPES = ['Batangan', 'Koin', 'Lainnya'];

// needs: kolom tambahan yang wajib dipilih untuk jenis harga tersebut
export const PRICE_TYPES = [
  { id: 'spot', label: 'Harga emas dunia (spot)', needs: [] },
  { id: 'retail_batangan', label: 'Harga batangan (retail)', needs: ['brand'] },
  { id: 'buyback_batangan', label: 'Buyback batangan', needs: ['brand'] },
  { id: 'perhiasan', label: 'Harga perhiasan per kadar', needs: ['purity'] },
  { id: 'buyback_perhiasan', label: 'Buyback perhiasan per kadar', needs: ['purity'] },
];
