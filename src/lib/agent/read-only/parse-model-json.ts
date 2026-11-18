/** Formatting transport only. Never repairs JSON, extracts prose or changes semantics. */
export class ModelJsonParseError extends Error {
  constructor(
    readonly code: "invalid_json" | "output_limit",
    readonly outputFormat: "json_object" | "markdown_fence" | "other",
    readonly outputBytes: number,
  ) {
    super(code);
  }
}

export function parseModelJson(content: string): unknown {
  const outputBytes = Buffer.byteLength(content, "utf8");
  const trimmed = content.trim();
  const outputFormat = trimmed.startsWith("```") ? "markdown_fence"
    : trimmed.startsWith("{") ? "json_object" : "other";
  if (outputBytes > 65_536)
    throw new ModelJsonParseError("output_limit", outputFormat, outputBytes);

  // Only unwrap one complete outer Markdown fence. Text before/after, multiple
  // objects, truncated JSON and malformed syntax must still fail closed.
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  try {
    return JSON.parse(fence ? fence[1] : trimmed) as unknown;
  } catch {
    // Never expose the JS parser message: it can contain raw response snippets.
    throw new ModelJsonParseError("invalid_json", outputFormat, outputBytes);
  }
}
