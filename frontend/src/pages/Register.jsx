import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, Building2, MapPin, Upload, FileCheck, X } from 'lucide-react';
import api from '../lib/api';

const FileUploadField = ({ label, hint, value, onChange }) => {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.url, file.name);
    } catch {
      setError('Upload thất bại, thử lại');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <p className="field-hint">{hint}</p>
      {value ? (
        <div className="file-uploaded">
          <FileCheck size={18} className="file-icon-ok" />
          <span className="file-name">{value.name}</span>
          <button type="button" className="file-remove" onClick={() => onChange('', '')}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="file-upload-btn"
          onClick={() => inputRef.current.click()}
          disabled={uploading}
        >
          <Upload size={18} />
          {uploading ? 'Đang tải lên...' : 'Chọn file (ảnh hoặc PDF)'}
        </button>
      )}
      {error && <span className="field-error">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: '', password: '', confirm: '',
    pharmacy_name: '', address: '',
  });
  const [licenses, setLicenses] = useState({
    business: { url: '', name: '' },
    pharma: { url: '', name: '' },
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Mật khẩu xác nhận không khớp');
    if (form.password.length < 6) return setError('Mật khẩu tối thiểu 6 ký tự');
    if (!licenses.business.url || !licenses.pharma.url) return setError('Vui lòng tải lên đầy đủ 2 giấy phép');

    setLoading(true);
    try {
      await api.post('/auth/register', {
        phone: form.phone,
        password: form.password,
        pharmacy_name: form.pharmacy_name,
        address: form.address,
        business_license_url: licenses.business.url,
        pharma_license_url: licenses.pharma.url,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại, thử lại');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2>Đăng ký thành công!</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>
            Hồ sơ của bạn đang được xét duyệt.<br />
            Chúng tôi sẽ liên hệ trong <strong>1–2 ngày làm việc</strong>.
          </p>
          <p style={{ marginBottom: 24 }}>Hotline: <strong>0966 050 306</strong></p>
          <button className="btn-primary btn-full" onClick={() => navigate('/login')}>
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: 480 }}>
        <div className="login-logo">
          <div className="logo-icon">💊</div>
        </div>
        <h2>Đăng ký tài khoản</h2>
        <p className="login-subtitle">Dành cho nhà thuốc, phòng khám</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Số điện thoại *</label>
            <div className="input-wrap">
              <Phone size={18} className="input-icon" />
              <input type="tel" placeholder="Nhập số điện thoại" value={form.phone} onChange={set('phone')} required />
            </div>
          </div>

          <div className="form-group">
            <label>Mật khẩu *</label>
            <div className="input-wrap">
              <Lock size={18} className="input-icon" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Tối thiểu 6 ký tự"
                value={form.password}
                onChange={set('password')}
                required
              />
              <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Xác nhận mật khẩu *</label>
            <div className="input-wrap">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Nhập lại mật khẩu"
                value={form.confirm}
                onChange={set('confirm')}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Tên nhà thuốc / cơ sở *</label>
            <div className="input-wrap">
              <Building2 size={18} className="input-icon" />
              <input type="text" placeholder="VD: Nhà thuốc An Khang" value={form.pharmacy_name} onChange={set('pharmacy_name')} required />
            </div>
          </div>

          <div className="form-group">
            <label>Địa chỉ *</label>
            <div className="input-wrap">
              <MapPin size={18} className="input-icon" />
              <input type="text" placeholder="Số nhà, đường, phường/xã, tỉnh/thành" value={form.address} onChange={set('address')} required />
            </div>
          </div>

          <div className="license-section">
            <p className="license-section-title">Giấy phép kinh doanh</p>

            <FileUploadField
              label="Giấy chứng nhận đăng ký kinh doanh *"
              hint="Ảnh chụp hoặc scan bản gốc (JPG, PNG, PDF – tối đa 10MB)"
              value={licenses.business.url ? licenses.business : null}
              onChange={(url, name) => setLicenses({ ...licenses, business: { url, name } })}
            />

            <FileUploadField
              label="Giấy chứng nhận đủ điều kiện kinh doanh dược *"
              hint="Ảnh chụp hoặc scan bản gốc (JPG, PNG, PDF – tối đa 10MB)"
              value={licenses.pharma.url ? licenses.pharma : null}
              onChange={(url, name) => setLicenses({ ...licenses, pharma: { url, name } })}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Đang gửi hồ sơ...' : 'GỬI HỒ SƠ ĐĂNG KÝ'}
          </button>
        </form>

        <div className="login-footer" style={{ marginTop: 16 }}>
          <p>Đã có tài khoản? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Đăng nhập</Link></p>
        </div>
      </div>
    </div>
  );
}
