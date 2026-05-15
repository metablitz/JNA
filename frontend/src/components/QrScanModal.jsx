import { useEffect, useRef, useState } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { applyTierDiscount } from '../lib/tiers';

function formatPrice(price) {
  return price?.toLocaleString('vi-VN') + 'đ';
}

export default function QrScanModal({ onClose }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(true);
  const [results, setResults] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const { setItemQty } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    Html5Qrcode.getCameras().then(cameras => {
      if (!cameras || cameras.length === 0) return;
      const camId = cameras[cameras.length - 1].id; // prefer back camera
      scanner.start(
        camId,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (decodedText === lastCode) return;
          setLastCode(decodedText);
          handleScan(decodedText);
        },
        () => {}
      ).catch(console.error);
    }).catch(console.error);

    return () => {
      scanner.isRunning() && scanner.stop().catch(() => {});
    };
  }, []);

  const handleScan = async (code) => {
    setScanning(false);
    setNotFound(false);
    try {
      const res = await api.get('/products/scan', { params: { code } });
      if (res.data.products.length === 0) {
        setNotFound(true);
      } else {
        setResults(res.data.products);
      }
    } catch {
      setNotFound(true);
    }
  };

  const handleAddAndClose = (product) => {
    setItemQty(product, 1);
    onClose();
  };

  const handleRescan = () => {
    setResults([]);
    setNotFound(false);
    setLastCode('');
    setScanning(true);
    if (scannerRef.current && !scannerRef.current.isRunning()) {
      Html5Qrcode.getCameras().then(cameras => {
        if (!cameras || cameras.length === 0) return;
        scannerRef.current.start(
          cameras[cameras.length - 1].id,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (decodedText === lastCode) return;
            setLastCode(decodedText);
            handleScan(decodedText);
          },
          () => {}
        ).catch(console.error);
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Quét mã barcode</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="qr-body">
          <div id="qr-reader" className={`qr-reader-box ${!scanning ? 'qr-reader-hidden' : ''}`} />

          {scanning && (
            <p className="qr-hint">Hướng camera vào mã vạch trên hộp thuốc</p>
          )}

          {notFound && (
            <div className="qr-not-found">
              <p>Không tìm thấy sản phẩm</p>
              <button className="btn-secondary" onClick={handleRescan}>Quét lại</button>
            </div>
          )}

          {results.length > 0 && (
            <div className="qr-results">
              {results.map((p) => {
                const userPrice = applyTierDiscount(p.price, user?.tier);
                const hasTierDiscount = userPrice !== p.price;
                return (
                  <div key={p.id} className="qr-result-item">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="qr-result-img" />
                      : <div className="qr-result-img qr-result-placeholder">💊</div>
                    }
                    <div className="qr-result-info">
                      <p className="qr-result-name">{p.name}</p>
                      <p className="qr-result-price">
                        {formatPrice(hasTierDiscount ? userPrice : p.price)}
                        {hasTierDiscount && (
                          <span className="product-original-price">{formatPrice(p.price)}</span>
                        )}
                        <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 4 }}>/ {p.unit}</span>
                      </p>
                      {p.stock === 0 && <p style={{ color: '#ef4444', fontSize: 12 }}>Hết hàng</p>}
                    </div>
                    <button
                      className="btn-primary qr-add-btn"
                      onClick={() => handleAddAndClose(p)}
                      disabled={p.stock === 0}
                    >
                      <ShoppingCart size={15} />
                    </button>
                  </div>
                );
              })}
              <button className="btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={handleRescan}>
                Quét thêm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
