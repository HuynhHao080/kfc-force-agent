import { DomainError } from "@/lib/domain-error";

export const MAX_JSON_BYTES = 16000;

/** Bound bytes before decoding/parsing, including bodies without Content-Length. */
export async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_JSON_BYTES) {
    await request.body?.cancel().catch(() => {});
    throw new DomainError("BODY_TOO_LARGE", "Yêu cầu quá dài.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader)
    throw new DomainError(
      "INVALID_JSON",
      "Yêu cầu không phải JSON hợp lệ.",
      400,
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) {
        await reader.cancel().catch(() => {});
        throw new DomainError("BODY_TOO_LARGE", "Yêu cầu quá dài.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new DomainError(
      "INVALID_JSON",
      "Yêu cầu không phải JSON hợp lệ.",
      400,
    );
  }
}
