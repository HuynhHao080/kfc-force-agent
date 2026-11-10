import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** A persisted request ceiling for the single-process AWS deployment. */
export function reserveBedrockInvocation(directory = process.env.LOCAL_DATA_DIR || ".local", now = new Date()) {
  const configured = process.env.BEDROCK_DAILY_REQUEST_LIMIT ?? "25";
  if (!/^\d+$/.test(configured) || Number(configured) > 1000)
    throw new Error("BEDROCK_DAILY_REQUEST_LIMIT must be an integer from 0 to 1000.");
  const limit = Number(configured);
  if (!limit) throw new Error("Bedrock inference is disabled by the request budget.");
  const day = now.toISOString().slice(0, 10);
  const root = resolve(/* turbopackIgnore: true */ directory);
  mkdirSync(root, { recursive: true });
  const file = resolve(root, "bedrock-usage.json");
  let used = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (!saved || !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) ||
        !Number.isFinite(Date.parse(saved.day + "T00:00:00.000Z")) ||
        new Date(saved.day + "T00:00:00.000Z").toISOString().slice(0, 10) !== saved.day ||
        !Number.isSafeInteger(saved.used) || saved.used < 0 || saved.day > day)
      throw new Error("The Bedrock request budget file is invalid.");
    if (saved.day === day) used = saved.used;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // RANG BUỘC: fonction này được thiết kế cho MỘT TIẾN TRÌNH duyệt (single-process),
  // không hỗ trợ nhiều process đồng thời. Read-modify-write trên file JSON không có
  // file locking, không thay thế được atomic locking. Nếu cần multi-process, phải
  // bổ sung cơ chế khóa nguyên tại lớp triển khai AWS.
  if (used >= limit) throw new Error("The daily Bedrock request ceiling has been reached.");
  const temporary = file + ".tmp";
  writeFileSync(temporary, JSON.stringify({ day, used: used + 1 }) + "\n", { mode: 0o600 });
  renameSync(temporary, file);
  return { day, used: used + 1, limit };
}
