import { supabase } from './supabase';

// Potong tengah jadi persegi dan perkecil agar hemat kuota & penyimpanan
export async function compressImage(file, size = 256, quality = 0.8) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2;
  const sy = (bmp.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memproses gambar'))), 'image/jpeg', quality)
  );
}

export const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

const cacheKey = (uid) => `gb_avatar_${uid}`;
export const getCachedAvatar = (uid) => localStorage.getItem(cacheKey(uid));
export const cacheAvatar = (uid, dataUrl) => localStorage.setItem(cacheKey(uid), dataUrl);

// Unggah foto profil ke Storage privat: avatars/<user_id>/avatar.jpg
export async function uploadAvatar(uid, blob) {
  const path = `${uid}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  const { error: e2 } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', uid);
  if (e2) throw e2;
  cacheAvatar(uid, await blobToDataURL(blob));
  return path;
}

// Ambil foto dari cache; bila belum ada dan online, unduh lalu simpan di cache
export async function loadAvatar(uid, path) {
  const cached = getCachedAvatar(uid);
  if (cached) return cached;
  if (!path || !navigator.onLine) return null;
  const { data, error } = await supabase.storage.from('avatars').download(path);
  if (error || !data) return null;
  const url = await blobToDataURL(data);
  cacheAvatar(uid, url);
  return url;
}
