import { createHash } from "node:crypto";
import type { Order } from "@/lib/types/order";
/** Change detector for the exact sampled order window; never an authorization token. */
export function orderWindowRevision(orders: Order[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...orders]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((o) => [
            o.id,
            o.status,
            o.currency,
            o.subtotal,
            o.discount,
            o.deliveryFee,
            o.total,
            o.fulfillment ?? "",
            o.customerName ?? "",
            o.phone ?? "",
            o.createdAt,
            o.updatedAt,
          ]),
      ),
    )
    .digest("hex");
}
