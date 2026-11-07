export interface ProductSales {
  menuItemId: string;
  name: string;
  units: number;
  orderCount: number;
  gross: number;
}
export interface SalesReport {
  basisRevision: string;
  generatedAt: string;
  sampleLimit: number;
  sampledOrders: number;
  matchedOrders: number;
  completedOrders: number;
  excludedOrders: number;
  units: number;
  gross: number;
  discount: number;
  deliveryFee: number;
  net: number;
  topLimit: number;
  products: ProductSales[];
}
