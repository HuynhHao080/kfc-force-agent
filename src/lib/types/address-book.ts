import type { Address } from "./user";
export interface AddressBook {
  addresses: Address[];
  revision: string;
}
