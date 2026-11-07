import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cookies } from "next/headers";

const COOKIE = "kfc_guest";
const MAX_AGE = 60 * 60 * 24 * 30;
let secret: string | undefined;
export function getSessionSecret(): string {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32)
      throw new Error("SESSION_SECRET must contain at least 32 characters");
    return (secret = process.env.SESSION_SECRET);
  }
  const directory = resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || ".local",
  );
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "session-secret");
  try {
    secret = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try {
      writeFileSync(file, randomBytes(48).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST")
        throw writeError;
    }
    secret = readFileSync(file, "utf8");
  }
  if (!secret || secret.length < 32)
    throw new Error("Local session signing secret is invalid");
  return secret;
}
const sign = (value: string) =>
  createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
export async function readGuest(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof parsed.userId === "string" &&
      /^guest_[a-f0-9-]{36}$/.test(parsed.userId) &&
      typeof parsed.expires === "number" &&
      parsed.expires > Date.now()
      ? parsed.userId
      : null;
  } catch {
    return null;
  }
}
export async function ensureGuest(request: Request): Promise<string> {
  const existing = await readGuest();
  if (existing) return existing;
  const userId = `guest_${randomUUID()}`;
  const payload = Buffer.from(
    JSON.stringify({ userId, expires: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: MAX_AGE,
  });
  return userId;
}
