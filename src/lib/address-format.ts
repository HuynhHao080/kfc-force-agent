import type { Address } from "./types/user";
export const formatSavedAddress = (address: Address) =>
  [address.addressLine, address.ward, address.district, address.city]
    .filter(Boolean)
    .join(", ");
