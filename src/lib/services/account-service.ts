import {
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { CURRENT_KDF, derive } from "@/lib/password-crypto.cjs";
import type { AccountRepository } from "@/lib/db/repositories/interfaces/account-repository.interface";
import type { CustomerAccount, CustomerProfile } from "@/lib/types/account";
import { DomainError } from "@/lib/domain-error";
export const accountVersion = (account: CustomerAccount) =>
  createHash("sha256").update(account.passwordHash).digest("hex");
export const publicProfile = (account: CustomerAccount): CustomerProfile => ({
  id: account.id,
  email: account.email,
  fullName: account.fullName,
});
export class AccountService {
  constructor(private accounts: AccountRepository) {}
  createSession(id: string, accountId: string, expires: number) {
    return this.accounts.createAuthSession(id, accountId, expires);
  }
  getSession(id: string) {
    return this.accounts.getAuthSession(id);
  }
  removeSession(id: string) {
    return this.accounts.removeAuthSession(id);
  }
  getById(id: string) {
    return this.accounts.getAccountById(id);
  }
  async updateProfile(
    account: CustomerAccount,
    fullName: string,
  ): Promise<CustomerProfile> {
    const updated = await this.accounts.updateAccount(
      account.id,
      {
        fullName: fullName.trim(),
        updatedAt: new Date().toISOString(),
      },
      account.passwordHash,
    );
    return publicProfile(updated);
  }
  async changePassword(
    account: CustomerAccount,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const actual = (await derive(
      currentPassword,
      account.passwordSalt,
      account.passwordKdf ?? "scrypt-legacy",
    )) as Buffer;
    const expected = Buffer.from(account.passwordHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new DomainError(
        "PASSWORD_INCORRECT",
        "Mật khẩu hiện tại không đúng.",
        400,
      );
    if (currentPassword === newPassword)
      throw new DomainError(
        "PASSWORD_UNCHANGED",
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    const salt = randomBytes(32).toString("hex");
    const hash = ((await derive(newPassword, salt)) as Buffer).toString("hex");
    // Account-versioned cookies become invalid on every browser after this CAS.
    await this.accounts.updateAccount(
      account.id,
      {
        passwordSalt: salt,
        passwordHash: hash,
        passwordKdf: CURRENT_KDF,
        updatedAt: new Date().toISOString(),
      },
      account.passwordHash,
    );
  }
  async register(input: {
    email: string;
    fullName: string;
    password: string;
  }): Promise<CustomerAccount> {
    const email = input.email.trim().toLowerCase();
    if (await this.accounts.getAccountByEmail(email))
      throw new DomainError("EMAIL_EXISTS", "Email đã được đăng ký.", 409);
    const salt = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const account: CustomerAccount = {
      id: `user_${randomUUID()}`,
      email,
      fullName: input.fullName.trim(),
      passwordSalt: salt,
      passwordKdf: CURRENT_KDF,
      passwordHash: ((await derive(input.password, salt)) as Buffer).toString(
        "hex",
      ),
      createdAt: now,
      updatedAt: now,
    };
    await this.accounts.createAccount(account);
    return account;
  }
  async login(email: string, password: string): Promise<CustomerAccount> {
    const account = await this.accounts.getAccountByEmail(
      email.trim().toLowerCase(),
    );
    const salt = account?.passwordSalt ?? "00000000000000000000000000000000";
    const derived = (await derive(
      password,
      salt,
      account ? (account.passwordKdf ?? "scrypt-legacy") : CURRENT_KDF,
    )) as Buffer;
    const expected = account
      ? Buffer.from(account.passwordHash, "hex")
      : Buffer.alloc(64);
    if (
      !account ||
      expected.length !== derived.length ||
      !timingSafeEqual(expected, derived)
    )
      throw new DomainError(
        "LOGIN_FAILED",
        "Email hoặc mật khẩu không đúng.",
        401,
      );
    return account;
  }
}
