import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>404</div>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>Trang không tồn tại</p>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Trang bạn tìm kiếm không có hoặc đã bị xóa.</p>
      <button
        onClick={() => navigate('/')}
        style={{ background: '#16a34a', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15, marginTop: 8 }}
      >
        Về trang chủ
      </button>
    </div>
  );
}
