import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionSecret } from "./guest-session";
const signature = (domain: string, payload: string) =>
  createHmac("sha256", getSessionSecret())
    .update(`${domain}:${payload}`)
    .digest("base64url");
export function issueToken(
  domain: string,
  data: Record<string, unknown>,
  seconds: number,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...data, expires: Date.now() + seconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${signature(domain, payload)}`;
}
export function readToken(
  domain: string,
  token?: string,
): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, digest] = parts;
  const expected = Buffer.from(signature(domain, payload));
  const actual = Buffer.from(digest);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data &&
      typeof data === "object" &&
      typeof data.expires === "number" &&
      data.expires > Date.now()
      ? data
      : null;
  } catch {
    return null;
  }
}
