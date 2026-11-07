import type { CustomerAccount } from "@/lib/types/account";
export type AccountPatch = Partial<
  Pick<
    CustomerAccount,
    "fullName" | "passwordHash" | "passwordSalt" | "passwordKdf"
  >
> & { updatedAt: string };
export interface AccountRepository {
  updateAccount(
    id: string,
    patch: AccountPatch,
    expectedPasswordHash: string,
  ): Promise<CustomerAccount>;
  createAuthSession(
    id: string,
    accountId: string,
    expires: number,
  ): Promise<void>;
  getAuthSession(
    id: string,
  ): Promise<{ accountId: string; expires: number } | null>;
  removeAuthSession(id: string): Promise<void>;
  createAccount(account: CustomerAccount): Promise<void>;
  getAccountById(id: string): Promise<CustomerAccount | null>;
  getAccountByEmail(email: string): Promise<CustomerAccount | null>;
}
