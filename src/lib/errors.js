// Terjemahkan pesan error teknis menjadi bahasa Indonesia yang mudah dipahami
export function friendlyError(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (m.includes('permission denied')) return 'Izin akses database belum diatur. Jalankan file goldbite-patch-izin.sql di Supabase.';
  if (m.includes('not_admin')) return 'Akun ini bukan Super Admin.';
  if (m.includes('username_taken')) return 'Username sudah dipakai. Coba username lain.';
  if (m.includes('invalid login')) return 'Email atau password salah.';
  if (m.includes('already registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk email Anda.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('offline')) return 'Tidak ada koneksi internet. Coba lagi saat online.';
  if (m.includes('database error')) return 'Data tidak dapat disimpan. Username mungkin sudah dipakai.';
  if (m.includes('password should be')) return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
  return 'Terjadi kesalahan. Silakan coba lagi.';
}
