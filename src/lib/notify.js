// Notifikasi perangkat (lokal). Muncul saat aplikasi sedang berjalan; notifikasi latar belakang
// saat aplikasi tertutup membutuhkan layanan server (belum termasuk).
export const canNotify = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const notifyPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function askNotifyPermission() {
  if (!canNotify()) return 'unsupported';
  return Notification.requestPermission();
}

export async function showLocalNotification(title, body, tag) {
  try {
    if (notifyPermission() !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/favicon.png' });
    return true;
  } catch { return false; }
}
