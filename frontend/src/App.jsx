import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './pages/NotFound';

// Core pages — eager (small, needed immediately)
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';

// Customer pages — lazy
const Catalog       = lazy(() => import('./pages/Catalog'));
const Cart          = lazy(() => import('./pages/Cart'));
const Orders        = lazy(() => import('./pages/Orders'));
const OrderDetail   = lazy(() => import('./pages/OrderDetail'));
const Profile       = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Chat          = lazy(() => import('./pages/Chat'));
const Wishlist      = lazy(() => import('./pages/Wishlist'));

// Admin pages — lazy (never needed by customers)
const Dashboard          = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts      = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders        = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers         = lazy(() => import('./pages/admin/AdminUsers'));
const AdminRegistrations = lazy(() => import('./pages/admin/AdminRegistrations'));
const AdminPriceList     = lazy(() => import('./pages/admin/AdminPriceList'));
const AdminChat          = lazy(() => import('./pages/admin/AdminChat'));
const AdminDebtReport    = lazy(() => import('./pages/admin/AdminDebtReport'));
const AdminBroadcast     = lazy(() => import('./pages/admin/AdminBroadcast'));
const AdminRevenue       = lazy(() => import('./pages/admin/AdminRevenue'));
const AdminStock         = lazy(() => import('./pages/admin/AdminStock'));

function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
        <WishlistProvider>
        <ToastProvider>
        <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/products" element={<ProtectedRoute adminOnly><AdminProducts /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/registrations" element={<ProtectedRoute adminOnly><AdminRegistrations /></ProtectedRoute>} />
          <Route path="/admin/pricelist" element={<ProtectedRoute adminOnly><AdminPriceList /></ProtectedRoute>} />
          <Route path="/admin/chat" element={<ProtectedRoute adminOnly><AdminChat /></ProtectedRoute>} />
          <Route path="/admin/debt" element={<ProtectedRoute adminOnly><AdminDebtReport /></ProtectedRoute>} />
          <Route path="/admin/broadcast" element={<ProtectedRoute adminOnly><AdminBroadcast /></ProtectedRoute>} />
          <Route path="/admin/revenue" element={<ProtectedRoute adminOnly><AdminRevenue /></ProtectedRoute>} />
          <Route path="/admin/stock" element={<ProtectedRoute adminOnly><AdminStock /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ToastProvider>
        </WishlistProvider>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}
