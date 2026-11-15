import type { Basket } from "@/lib/storefront-types";

export interface CartReview {
  basket: Basket;
  checkedAt: string;
  items: {
    cartItemId: string;
    imageUrl?: string;
    available: boolean;
  }[];
}
