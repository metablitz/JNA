import { X } from 'lucide-react';

export default function ConfirmModal({ title, message, confirmLabel = 'Xác nhận', confirmClass = 'btn-danger', onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onCancel}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: '#6b7280' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Hủy</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
