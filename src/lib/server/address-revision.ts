import { createHash } from "node:crypto";
import type { Address } from "@/lib/types/user";
export function addressRevision(userId: string, addresses: Address[]): string {
  const rows = addresses
    .map((entry) => [
      entry.id,
      entry.label,
      entry.recipientName,
      entry.phone,
      entry.addressLine,
      entry.ward,
      entry.district,
      entry.city,
      entry.isDefault,
      entry.updatedAt,
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256")
    .update(JSON.stringify([userId, rows]))
    .digest("hex");
}
