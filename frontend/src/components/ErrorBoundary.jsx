import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>Đã xảy ra lỗi</p>
          <p style={{ color: '#6b7280', fontSize: 13 }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#16a34a', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15 }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
