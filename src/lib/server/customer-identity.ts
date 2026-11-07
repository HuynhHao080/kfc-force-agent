import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { readGuest, ensureGuest } from "./guest-session";
import { issueToken, readToken } from "./session-token";
import { services } from "@/lib/agent/agent-core";
import { accountVersion, publicProfile } from "@/lib/services/account-service";
import type { CustomerAccount } from "@/lib/types/account";
const COOKIE = "kfc_customer";
export async function customerAccount() {
  const token = readToken("customer", (await cookies()).get(COOKIE)?.value);
  if (typeof token?.accountId !== "string") return null;
  if (typeof token.sessionId !== "string") return null;
  const session = await services.accountService.getSession(token.sessionId);
  if (!session || session.accountId !== token.accountId) return null;
  const account = await services.accountService.getById(token.accountId);
  return account && accountVersion(account) === token.version ? account : null;
}
export async function readCustomer(): Promise<string | null> {
  const account = await customerAccount();
  if (account) return account.id;
  // A revoked account cookie must not silently authorize a different guest.
  if ((await cookies()).get(COOKIE)?.value) return null;
  return readGuest();
}
export async function ensureCustomer(request: Request) {
  const account = await customerAccount();
  if (!account && (await cookies()).get(COOKIE)?.value)
    await clearCustomerCookie();
  return {
    userId: account?.id ?? (await ensureGuest(request)),
    profile: account ? publicProfile(account) : null,
  };
}
export async function signInCustomer(
  request: Request,
  account: CustomerAccount,
) {
  const sessionId = randomUUID();
  await services.accountService.createSession(
    sessionId,
    account.id,
    Date.now() + 86400 * 30 * 1000,
  );
  (await cookies()).set(
    COOKIE,
    issueToken(
      "customer",
      { sessionId, accountId: account.id, version: accountVersion(account) },
      86400 * 30,
    ),
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      maxAge: 86400 * 30,
    },
  );
}
export async function signOutCustomer() {
  const token = readToken("customer", (await cookies()).get(COOKIE)?.value);
  if (typeof token?.sessionId === "string")
    await services.accountService.removeSession(token.sessionId);
  await clearCustomerCookie();
}
export async function clearCustomerCookie() {
  (await cookies()).set(COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
}
