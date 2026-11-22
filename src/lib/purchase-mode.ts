/**
 * Chế độ phụ: chuyển khách sang website KFC để tự đặt và thanh toán, không tạo đơn xuống bếp.
 * Không thuộc phạm vi khoá luận; luồng chính là đặt đơn → CONFIRMED → kitchen board.
 */
export function kfcPurchaseAssistantEnabled(): boolean {
  return process.env.KFC_PURCHASE_ASSISTANT === "1";
}

/**
 * Thực đơn KFC thật (snapshot trong source hoặc KFC_CATALOG_FILE) thay cho thực đơn demo.
 * Tách khỏi chế độ mua hàng để luồng đặt đơn dùng được thực đơn thật.
 * KFC_CATALOG=kfc | demo; để trống thì giữ hành vi cũ (theo KFC_PURCHASE_ASSISTANT).
 */
export function kfcCatalogEnabled(): boolean {
  const value = process.env.KFC_CATALOG?.trim().toLowerCase();
  if (value === "kfc") return true;
  if (value === "demo") return false;
  return kfcPurchaseAssistantEnabled();
}
