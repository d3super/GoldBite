import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { pinExists, clearPin } from '../lib/pin';
import { uploadAvatar } from '../lib/image';
import { ResultModal } from '../components/ui';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const LOCK_AFTER_MS = 5 * 60 * 1000; // kunci otomatis setelah 5 menit di latar belakang

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('gb_theme') || 'system');
  const [session, setSession] = useState(null);
  const [offlineUid, setOfflineUid] = useState(null); // dipakai saat offline & token kedaluwarsa
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState(null);
  const suppress = useRef(false); // abaikan event auth saat proses login/daftar berjalan
  const hiddenAt = useRef(0);

  const user = session?.user ?? (offlineUid ? { id: offlineUid, email: profile?.email } : null);

  // ---------- Tema (terang / gelap / ikuti sistem) ----------
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1B26' : '#142B3B');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (t) => { localStorage.setItem('gb_theme', t); setThemeState(t); };
  const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  // ---------- Status koneksi ----------
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ---------- Profil (dengan cadangan lokal agar bisa dibuka offline) ----------
  const loadProfile = useCallback(async (uid) => {
    const key = `gb_profile_${uid}`;
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (error) throw error;
      localStorage.setItem(key, JSON.stringify(data));
      setProfile(data);
    } catch {
      const c = localStorage.getItem(key);
      setProfile(c ? JSON.parse(c) : null);
    }
  }, []);

  const finishLogin = useCallback(async (s) => {
    setSession(s);
    setOfflineUid(null);
    setHasPin(pinExists(s.user.id));
    localStorage.setItem('gb_last_user', s.user.id);
    await loadProfile(s.user.id);
    setLocked(false); // baru saja memasukkan password, jadi tidak perlu PIN lagi
  }, [loadProfile]);

  // ---------- Booting ----------
  useEffect(() => {
    let alive = true;
    const minDelay = new Promise((r) => setTimeout(r, 1200));
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const s = data.session;
      if (s) {
        setSession(s);
        setHasPin(pinExists(s.user.id));
        await loadProfile(s.user.id);
      } else if (!navigator.onLine) {
        // Offline dan token tidak bisa diperbarui: izinkan buka data lokal bila PIN sudah ada di perangkat ini
        const last = localStorage.getItem('gb_last_user');
        if (last && pinExists(last)) {
          setOfflineUid(last);
          setHasPin(true);
          await loadProfile(last);
        }
      }
      await minDelay;
      if (alive) setBooting(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (suppress.current) return;
      if (event === 'PASSWORD_RECOVERY') { setSession(s); setRecovery(true); setLocked(false); return; }
      if (event === 'SIGNED_OUT') {
        setSession(null); setProfile(null); setHasPin(false); setLocked(true); setOfflineUid(null);
        return;
      }
      if (s && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_IN')) setSession(s);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // ---------- Kunci otomatis ----------
  useEffect(() => {
    const h = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS && hasPin) setLocked(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [hasPin]);

  // ---------- Aksi ----------
  const notify = useCallback((n) => setNotice(n), []);

  const login = async (email, password, requireRole) => {
    suppress.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (requireRole) {
        const { data: p, error: e2 } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        if (e2) {
          // Gagal membaca profil (mis. izin tabel belum diatur) BUKAN berarti bukan admin
          await supabase.auth.signOut({ scope: 'local' });
          throw e2;
        }
        if (p?.role !== requireRole) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('NOT_ADMIN');
        }
      }
      await finishLogin(data.session);
    } finally {
      suppress.current = false;
    }
  };

  const register = async ({ email, password, username, fullName, avatarBlob }) => {
    suppress.current = true;
    try {
      const { data: free, error: e0 } = await supabase.rpc('username_available', { p_username: username });
      if (e0) throw e0;
      if (!free) throw new Error('USERNAME_TAKEN');
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { username, full_name: fullName } },
      });
      if (error) throw error;
      if (!data.session) return { needsConfirm: true };
      let avatarFailed = false;
      if (avatarBlob) {
        try { await uploadAvatar(data.user.id, avatarBlob); } catch { avatarFailed = true; }
      }
      await finishLogin(data.session);
      return { needsConfirm: false, avatarFailed };
    } finally {
      suppress.current = false;
    }
  };

  const logout = async () => {
    localStorage.removeItem('gb_last_user');
    await supabase.auth.signOut({ scope: 'local' }); // hanya perangkat ini, bukan semua perangkat
    setSession(null); setProfile(null); setHasPin(false); setLocked(true); setOfflineUid(null);
  };

  const sendReset = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });

  const finishRecovery = () => { setRecovery(false); setHasPin(pinExists(session?.user?.id)); };

  // Verifikasi password lalu hapus PIN lama (dipakai "Lupa PIN" dan "Ubah PIN")
  const resetPinWithPassword = async (password) => {
    const email = session?.user?.email;
    if (!email) throw new Error('offline');
    suppress.current = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      suppress.current = false;
    }
    clearPin(user.id);
    setHasPin(false);
    setLocked(false);
  };

  const pinCreated = () => { setHasPin(true); setLocked(false); };
  const unlock = () => setLocked(false);
  const lockNow = () => { if (hasPin) setLocked(true); };
  const refreshProfile = () => (user ? loadProfile(user.id) : null);

  const value = useMemo(() => ({
    theme, setTheme, toggleTheme, session, user, profile, booting, locked, hasPin, recovery, online, notify,
    login, register, logout, sendReset, finishRecovery, resetPinWithPassword, pinCreated, unlock, lockNow, refreshProfile,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [theme, session, offlineUid, profile, booting, locked, hasPin, recovery, online]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && (
        <ResultModal type={notice.type} title={notice.title} message={notice.message}
          onClose={() => { const cb = notice.onClose; setNotice(null); cb?.(); }} />
      )}
    </Ctx.Provider>
  );
}
