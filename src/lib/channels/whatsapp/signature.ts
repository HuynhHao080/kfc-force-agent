import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Kiểm header X-Hub-Signature-256 của Meta: "sha256=" + HMAC-SHA256(App Secret, raw body) dạng hex.
 * Phải dùng đúng byte của raw body (trước khi parse JSON). So sánh constant-time.
 */
export function verifySignature(
  rawBody: Uint8Array,
  header: string | null | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !header) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(match[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** So sánh hai chuỗi bí mật constant-time, kể cả khi khác độ dài. */
export function sameSecret(given: string, expected: string): boolean {
  const digest = (text: string) => createHash("sha256").update(text, "utf8").digest();
  return timingSafeEqual(digest(given), digest(expected)) && given.length === expected.length;
}
