export interface Promotion {
  code: string;
  title: string;
  discountType: "percent" | "fixed";
  value: number;
  minimumSubtotal: number;
  maxDiscount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  revision: string;
  createdAt: string;
  updatedAt: string;
}
export interface AppliedPromotion {
  code: string;
  title: string;
  revision: string;
  discount: number;
}
export interface CheckoutQuote {
  cartId: string;
  cartSignature: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promotion: AppliedPromotion | null;
}
