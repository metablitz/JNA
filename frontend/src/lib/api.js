import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // Attach human-readable message for network errors (server down)
    if (!err.response) {
      err.userMessage = 'Không kết nối được server. Vui lòng kiểm tra backend đang chạy.';
    } else {
      err.userMessage = err.response.data?.error || `Lỗi server (${err.response.status})`;
    }
    return Promise.reject(err);
  }
);

export default api;
