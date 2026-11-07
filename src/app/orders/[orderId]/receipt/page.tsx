import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readCustomer } from "@/lib/server/customer-identity";
import { withUserLock } from "@/lib/server/user-lock";
import { services } from "@/lib/agent/agent-core";
import { orderStatusLabels } from "@/lib/order-workflow";
import { money } from "@/lib/storefront-types";
import { PrintReceiptButton } from "@/components/storefront/print-receipt-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Phiếu đơn demo | KFC Force Agent",
  robots: { index: false, follow: false },
};
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const userId = await readCustomer();
  if (!userId || orderId.length > 100) notFound();
  const order = await withUserLock(userId, () =>
    services.checkoutService.detail(userId, orderId),
  );
  if (!order) notFound();
  const placed = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(order.createdAt));
  return (
    <main className="receipt-shell">
      <nav className="receipt-actions" aria-label="Thao tác phiếu đơn">
        <Link href="/chat" className="text-button">
          ← Về trang đặt món
        </Link>
        <PrintReceiptButton />
      </nav>
      <article className="receipt-paper" aria-labelledby="receipt-title">
        <header className="receipt-header">
          <strong className="receipt-brand">
            KFC <span>FORCE AGENT</span>
          </strong>
          <span className="status-badge">DỮ LIỆU DEMO</span>
        </header>
        <span className="eyebrow">THÔNG TIN ĐƠN ĐÃ GHI NHẬN</span>
        <h1 id="receipt-title">Phiếu đơn hàng</h1>
        <p className="receipt-id">Mã đơn: {order.id}</p>
        {order.store && <p className="receipt-note">{order.store.name} · {order.store.address}{order.store.phone ? " · " + order.store.phone : ""}</p>}
        <dl className="receipt-facts">
          <div>
            <dt>Thời điểm đặt (giờ Việt Nam)</dt>
            <dd>{placed}</dd>
          </div>
          <div>
            <dt>Trạng thái lúc mở phiếu</dt>
            <dd>{orderStatusLabels[order.status]}</dd>
          </div>
          <div>
            <dt>Hình thức nhận</dt>
            <dd>
              {order.fulfillment === "delivery"
                ? "Giao hàng demo"
                : "Nhận tại cửa hàng demo"}
            </dd>
          </div>
          <div>
            <dt>Khách hàng</dt>
            <dd>{order.customerName}</dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>{order.phone}</dd>
          </div>
          {order.fulfillment === "delivery" && (
            <div>
              <dt>Địa chỉ</dt>
              <dd>{String(order.shippingAddress?.address ?? "")}</dd>
            </div>
          )}
        </dl>
        <table className="receipt-items">
          <caption>Chi tiết món và giá tại thời điểm đặt đơn</caption>
          <thead>
            <tr>
              <th scope="col">Món</th>
              <th scope="col">SL</th>
              <th scope="col">Đơn giá</th>
              <th scope="col">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.nameSnapshot}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unitPrice)}</td>
                <td>{money(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="receipt-totals">
          <div>
            <dt>Tạm tính</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Giảm giá {order.promotion?.code ?? ""}</dt>
            <dd>{money(order.discount)}</dd>
          </div>
          <div>
            <dt>Phí giao hàng</dt>
            <dd>{money(order.deliveryFee)}</dd>
          </div>
          <div className="receipt-grand-total">
            <dt>Tổng giá trị đơn demo</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
        {order.note && (
          <p className="receipt-note">
            <strong>Ghi chú:</strong> {order.note}
          </p>
        )}
        <footer className="receipt-disclaimer">
          <strong>Chưa thu tiền · Không phải hoá đơn VAT</strong>
          <p>
            Project học tập KFC Force Agent. Phiếu này không xác nhận thanh
            toán, không gửi đơn đến nhà hàng hoặc đơn vị giao hàng thật.
          </p>
          <p>
            Phiếu có thông tin liên hệ. Chỉ in hoặc chia sẻ với người được phép
            xem.
          </p>
        </footer>
      </article>
    </main>
  );
}
