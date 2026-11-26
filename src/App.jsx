import { useApp } from './context/AppContext';
import { configOk } from './lib/supabase';
import { Splash, Logo } from './components/ui';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import { PinSetup, PinLock } from './pages/Pin';
import Shell from './pages/Shell';

function ConfigMissing() {
  return (
    <div className="app" style={{ padding: 28, textAlign: 'center' }}>
      <Logo size={64} />
      <h2 style={{ marginTop: 14 }}>Konfigurasi belum lengkap</h2>
      <p className="muted">
        Variabel <b>VITE_SUPABASE_URL</b> dan <b>VITE_SUPABASE_ANON_KEY</b> belum diisi. Isi di file <b>.env</b> (lokal)
        atau di Vercel &rarr; Settings &rarr; Environment Variables, lalu deploy ulang.
      </p>
    </div>
  );
}

export default function App() {
  const { booting, user, recovery, hasPin, locked } = useApp();

  if (!configOk) return <ConfigMissing />;
  if (booting) return <Splash />;
  if (recovery) return <ResetPassword />;
  if (!user) return <Auth />;
  if (!hasPin) return <PinSetup />;
  if (locked) return <PinLock />;
  return <Shell />;
}
