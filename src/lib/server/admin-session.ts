import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { CURRENT_KDF, deriveSync } from "@/lib/password-crypto.cjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cookies } from "next/headers";
import { issueToken, readToken } from "./session-token";
import { DomainError } from "@/lib/domain-error";
const COOKIE = "kfc_staff";
const shared = globalThis as typeof globalThis & {
  kfcStaffSessions?: Map<string, number>;
};
const sessions = (shared.kfcStaffSessions ??= new Map());
type Credentials = { salt: string; hash: string; kdf?: string };
let environmentCredentials: Credentials | undefined;
function credentials(): Credentials | null {
  if (process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12)
      throw new DomainError(
        "ADMIN_CONFIG",
        "Mật khẩu quản trị cấu hình phải ít nhất 12 ký tự.",
        503,
      );
    return (environmentCredentials ??= {
      salt: "kfc-environment-admin",
      hash: deriveSync(
        process.env.ADMIN_PASSWORD,
        "kfc-environment-admin",
      ).toString("hex"),
      kdf: CURRENT_KDF,
    });
  }
  const directory = resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || ".local",
  );
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(directory, "admin-credentials.json"), "utf8"),
    );
    if (
      parsed &&
      typeof parsed === "object" &&
      "salt" in parsed &&
      "hash" in parsed &&
      typeof parsed.salt === "string" &&
      typeof parsed.hash === "string" &&
      /^[a-f0-9]{64}$/.test(parsed.salt) &&
      /^[a-f0-9]{128}$/.test(parsed.hash)
    ) {
      const kdf =
        "kdf" in parsed && typeof parsed.kdf === "string"
          ? parsed.kdf
          : "scrypt-legacy";
      if (![CURRENT_KDF, "scrypt-legacy"].includes(kdf))
        throw new Error("Invalid KDF");
      return { salt: parsed.salt, hash: parsed.hash, kdf };
    }
    throw new Error("Invalid credentials file");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new DomainError(
      "ADMIN_CONFIG",
      "Cấu hình quản trị không hợp lệ. Chạy lại admin:setup -- --reset.",
      503,
    );
  }
}
const version = (config: Credentials) =>
  createHash("sha256").update(config.hash).digest("hex");
export function adminConfigured() {
  return !!credentials();
}
export async function adminAuthenticated() {
  const config = credentials();
  if (!config) return false;
  const token = readToken("staff", (await cookies()).get(COOKIE)?.value);
  return (
    token?.role === "admin" &&
    token.version === version(config) &&
    typeof token.sessionId === "string" &&
    (sessions.get(token.sessionId) ?? 0) > Date.now()
  );
}
export async function loginAdmin(request: Request, password: string) {
  const config = credentials();
  if (!config)
    throw new DomainError(
      "ADMIN_NOT_CONFIGURED",
      "Chưa thiết lập quản trị. Chạy npm run admin:setup trên máy chủ local.",
      503,
    );
  const derived = deriveSync(
    password,
    config.salt,
    config.kdf ?? "scrypt-legacy",
  );
  const expected = Buffer.from(config.hash, "hex");
  if (derived.length !== expected.length || !timingSafeEqual(derived, expected))
    throw new DomainError("LOGIN_FAILED", "Mật khẩu quản trị không đúng.", 401);
  for (const [key, expires] of sessions)
    if (expires <= Date.now()) sessions.delete(key);
  const sessionId = randomUUID();
  sessions.set(sessionId, Date.now() + 8 * 3600 * 1000);
  (await cookies()).set(
    COOKIE,
    issueToken(
      "staff",
      { sessionId, role: "admin", version: version(config) },
      8 * 3600,
    ),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 8 * 3600,
    },
  );
}
export async function logoutAdmin() {
  const token = readToken("staff", (await cookies()).get(COOKIE)?.value);
  if (typeof token?.sessionId === "string") sessions.delete(token.sessionId);
  (await cookies()).set(COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 0,
  });
}
