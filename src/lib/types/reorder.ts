export interface ReorderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  previousUnitPrice: number;
  previousName: string;
  subtotal: number;
}
export interface ReorderPreview {
  orderId: string;
  items: ReorderLine[];
  subtotal: number;
  confirmationToken: string;
  expiresAt: string;
}
