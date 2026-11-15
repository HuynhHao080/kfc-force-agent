import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { kfcCatalogSchema } from "./kfc-catalog";

const run = promisify(execFile);

export async function fetchCatalog(fetchPage: typeof fetch = fetch) {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error("CATALOG_KEY_MISSING");
  const id = randomUUID();
  const directory = resolve(
    process.env.LOCAL_DATA_DIR || ".local",
    "catalog-captures",
    id,
  );
  await mkdir(directory, { recursive: true });
  // Persist evidence of the attempt before sending the request. No keys or contacts.
  await writeFile(
    resolve(directory, "attempt.json"),
    JSON.stringify({ requestedAt: new Date().toISOString() }),
    { flag: "wx", mode: 0o600 },
  );
  const response = await fetchPage("https://api.fetch.tinyfish.ai", {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: ["https://kfcvietnam.com.vn/menu"],
      format: "html",
      include_selectors: ["app-product"],
      ttl: 3600,
      per_url_timeout_ms: 45000,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok || !response.body) throw new Error("CATALOG_FETCH_REJECTED");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20000000) throw new Error("CATALOG_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const raw = Buffer.concat(chunks);
  const rawPath = resolve(directory, "fetch.json");
  await writeFile(rawPath, raw, { flag: "wx", mode: 0o600 });
  const { stdout } = await run(
    process.platform === "win32" ? "python" : "python3",
    [resolve(process.cwd(), "scripts/parse-kfc-menu.py"), rawPath],
    { timeout: 15000, maxBuffer: 8000000, windowsHide: true },
  );
  const catalog = kfcCatalogSchema.parse({
    version: 1,
    source: {
      provider: "tinyfish",
      method: "fetch",
      url: "https://kfcvietnam.com.vn/menu",
      fetchedAt: new Date().toISOString(),
      runId: "fetch-" + id,
      rawSha256: createHash("sha256").update(raw).digest("hex"),
    },
    catalog: JSON.parse(stdout),
  });
  await writeFile(resolve(directory, "catalog.json"), JSON.stringify(catalog), {
    flag: "wx",
    mode: 0o600,
  });
  return catalog;
}
