const STATUS_LABELS = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao',
  delivered: 'Đã giao', cancelled: 'Đã hủy',
};

function fmt(n) { return n?.toLocaleString('vi-VN') + 'đ'; }

export default function PrintInvoice({ order }) {
  if (!order) return null;

  const paymentMethod =
    order.payment_method === 'cong_no' ? 'Công nợ' :
    order.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản';

  return (
    <div className="print-invoice" id="print-invoice">
      <div className="pi-header">
        <div className="pi-company">
          <h2>Công ty TNHH JNA</h2>
          <p>Hotline: 0966 050 306</p>
        </div>
        <div className="pi-title">
          <h1>HÓA ĐƠN ĐẶT HÀNG</h1>
          <p className="pi-code">{order.order_code}</p>
          <p className="pi-date">Ngày: {new Date(order.created_at).toLocaleDateString('vi-VN')}</p>
        </div>
      </div>

      <div className="pi-info">
        <div>
          <p><strong>Nhà thuốc:</strong> {order.users?.pharmacy_name || order.shipping_address}</p>
          <p><strong>Điện thoại:</strong> {order.users?.phone || '-'}</p>
          <p><strong>Địa chỉ giao:</strong> {order.shipping_address}</p>
        </div>
        <div>
          <p><strong>Trạng thái:</strong> {STATUS_LABELS[order.status] || order.status}</p>
          <p><strong>Thanh toán:</strong> {paymentMethod}</p>
          <p><strong>Trạng thái TT:</strong> {order.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
        </div>
      </div>

      <table className="pi-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}>STT</th>
            <th>Tên sản phẩm</th>
            <th style={{ width: 60 }}>ĐVT</th>
            <th style={{ width: 60 }}>SL</th>
            <th style={{ width: 100 }}>Đơn giá</th>
            <th style={{ width: 110 }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items?.map((item, i) => (
            <tr key={item.id}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{item.products?.name}</td>
              <td style={{ textAlign: 'center' }}>{item.products?.unit}</td>
              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{fmt(item.unit_price)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.total_price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid #1f2937' }}>TỔNG CỘNG</td>
            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, borderTop: '2px solid #1f2937' }}>{fmt(order.total_amount)}</td>
          </tr>
        </tfoot>
      </table>

      {order.note && <p className="pi-note"><strong>Ghi chú:</strong> {order.note}</p>}

      <div className="pi-footer">
        <div className="pi-sign">
          <p>Người đặt hàng</p>
          <div className="pi-sign-space" />
          <p><em>(Ký, ghi rõ họ tên)</em></p>
        </div>
        <div className="pi-sign">
          <p>Người giao hàng</p>
          <div className="pi-sign-space" />
          <p><em>(Ký, ghi rõ họ tên)</em></p>
        </div>
      </div>
    </div>
  );
}
