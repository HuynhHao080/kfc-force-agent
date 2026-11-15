import { normalizeVietnamese } from "@/lib/services/menu-service";
import { officialKfcSources } from "@/lib/catalog/official-sources";

export function officialAnswer(message: string): string | null {
  const text = normalizeVietnamese(message);
  if (/\b(di ung|allergen|dau phong|gluten)\b/.test(text))
    return `Bạn có thể xem bảng thành phần dị ứng do KFC công bố tại ${officialKfcSources.allergens}. Hãy xác nhận thành phần và khả năng tiếp xúc chéo với KFC trước khi mua nếu bạn có dị ứng thực phẩm.`;
  if (
    /\b(nha hang|cua hang|chi nhanh|quan kfc)\b/.test(text) &&
    /\b(tim|o dau|gan nhat|dia chi|he thong)\b/.test(text)
  )
    return `Bạn có thể tìm nhà hàng KFC và chọn địa điểm nhận phù hợp tại ${officialKfcSources.restaurants}. Nhà hàng và khả năng phục vụ địa chỉ được xác nhận trên KFC khi đặt hàng.`;
  return null;
}
