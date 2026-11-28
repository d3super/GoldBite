import { Component } from 'react';

// Bila ada kesalahan tampilan, tampilkan pesan yang jelas (bukan halaman kosong)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('GOLDBITE error tampilan:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '56px 24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ marginBottom: 8 }}>Terjadi kesalahan</h2>
        <p style={{ color: '#6B7683' }}>Halaman ini tidak dapat ditampilkan. Data Anda tetap aman.</p>
        <p style={{ color: '#D65B5B', fontSize: 12, wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{ padding: '12px 18px', borderRadius: 14, border: '1px solid #E4E8ED', background: 'transparent', marginRight: 8, cursor: 'pointer' }}
        >
          Coba lagi
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#142B3B', color: '#fff', cursor: 'pointer' }}
        >
          Muat ulang
        </button>
      </div>
    );
  }
}
