/* eslint-disable @typescript-eslint/no-require-imports -- Explicit TinyFish catalog collection CLI. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { loadEnvConfig } = require("@next/env");
require("./register-typescript.cjs");
const { z } = require("zod");
const {
  kfcExtractionSchema,
  kfcCatalogSchema,
} = require("../src/lib/catalog/kfc-catalog.ts");
const root = path.resolve(__dirname, "..");
const sourceUrl = "https://kfcvietnam.com.vn/menu";

function providerSchema(schema) {
  const result = {};
  for (const key of [
    "type",
    "required",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
  ]) {
    if (schema[key] !== undefined) result[key] = schema[key];
  }
  if (schema.properties)
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        providerSchema(value),
      ]),
    );
  if (schema.items) result.items = providerSchema(schema.items);
  return result;
}

function plan() {
  const schema = providerSchema(z.toJSONSchema(kfcExtractionSchema));
  return {
    url: sourceUrl,
    goal: [
      "Read the public Vietnamese KFC menu. Visit every menu category and extract actual visible products, prices in integer VND, descriptions, image URLs and source page URLs.",
      "Use stable alphanumeric IDs prefixed kfc_ from product IDs or slugs. Use separate IDs for categories. Preserve Vietnamese spelling. Deduplicate repeated products.",
      "Include only products with a clear fixed price and no required unrepresented choices. Report excluded configurable products, missing prices, and inaccessible categories in exclusions.",
      "Use only public pages on kfcvietnam.com.vn. Do not sign in, submit an order, add products to the official cart, supply contact details or bypass an access restriction.",
      "Do not invent products, prices, descriptions or availability. Descriptions may be empty. isAvailable means publicly listed as available on the observed page, without a store-specific guarantee.",
      "Image URLs must be HTTPS raster images on kfcvietnam.com.vn or kfcvn-static.cognizantorderserv.com. Return the required JSON schema.",
    ].join(" "),
    browser_profile: "lite",
    output_schema: schema,
  };
}

function parseArgs(values) {
  const args = { action: "plan" };
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (
      ["--start", "--collect", "--fetch", "--import-fetch"].includes(value) &&
      args.action === "plan"
    )
      args.action = value.slice(2);
    else if (value === "--job" && !args.job) args.job = values[++index];
    else if (value === "--input" && !args.input) args.input = values[++index];
    else
      throw new Error(
        "Use --fetch|--start|--collect --job <UUID>, --import-fetch --job <UUID> --input <file>, or no arguments for an offline plan.",
      );
  }
  if (
    args.action !== "plan" &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      args.job ?? "",
    )
  )
    throw new Error("A UUID --job is required for a TinyFish run.");
  if ((args.action === "import-fetch") !== !!args.input)
    throw new Error("--input is required only with --import-fetch.");
  return args;
}

async function tinyfish(
  key,
  endpoint,
  body,
  origin = "https://agent.tinyfish.ai",
) {
  const response = await fetch(origin + endpoint, {
    method: body ? "POST" : "GET",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45000),
    redirect: "error",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = String(
      error.error?.message ?? error.detail ?? "Request rejected",
    )
      .replaceAll(key, "[redacted]")
      .slice(0, 1500);
    throw new Error(`TinyFish HTTP ${response.status}: ${detail}`);
  }
  return response.json();
}

function catalogFromRun(run, rawBytes) {
  if (run.status !== "COMPLETED" || typeof run.run_id !== "string")
    throw new Error("Only a completed TinyFish run can produce a catalog.");
  return kfcCatalogSchema.parse({
    version: 1,
    source: {
      provider: "tinyfish",
      url: sourceUrl,
      fetchedAt: run.finished_at,
      runId: run.run_id,
      rawSha256: crypto.createHash("sha256").update(rawBytes).digest("hex"),
    },
    catalog: run.result,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.action === "plan") {
    console.log(JSON.stringify(plan(), null, 2));
    return;
  }
  loadEnvConfig(root);
  const key = process.env.TINYFISH_API_KEY;
  if (!key && args.action !== "import-fetch")
    throw new Error(
      "Set TINYFISH_API_KEY in the local environment before calling TinyFish.",
    );
  const directory = path.join(root, ".local/catalog-imports", args.job);
  fs.mkdirSync(directory, { recursive: true });
  const attemptPath = path.join(directory, "attempt.json");
  if (["fetch", "import-fetch"].includes(args.action)) {
    fs.writeFileSync(
      attemptPath,
      JSON.stringify({
        requestedAt: new Date().toISOString(),
        method: args.action,
        url: sourceUrl,
      }),
      { flag: "wx", mode: 0o600 },
    );
    const rawPath = path.join(directory, "tinyfish-fetch.json");
    let raw;
    if (args.action === "import-fetch") {
      if (fs.statSync(args.input).size > 20000000)
        throw new Error("TinyFish source file is too large.");
      raw = fs.readFileSync(args.input);
    } else {
      const response = await tinyfish(
        key,
        "",
        {
          urls: [sourceUrl],
          format: "html",
          include_selectors: ["app-product"],
          image_links: true,
          links: true,
          ttl: 0,
          per_url_timeout_ms: 45000,
        },
        "https://api.fetch.tinyfish.ai",
      );
      raw = Buffer.from(JSON.stringify(response, null, 2));
    }
    fs.writeFileSync(rawPath, raw, { flag: "wx", mode: 0o600 });
    const extracted = JSON.parse(
      execFileSync(
        "python",
        [path.join(__dirname, "parse-kfc-menu.py"), rawPath],
        {
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 8000000,
        },
      ),
    );
    const catalog = kfcCatalogSchema.parse({
      version: 1,
      source: {
        provider: "tinyfish",
        method: "fetch",
        url: sourceUrl,
        fetchedAt: new Date().toISOString(),
        runId: "fetch-" + args.job,
        rawSha256: crypto.createHash("sha256").update(raw).digest("hex"),
      },
      catalog: extracted,
    });
    const output = path.join(directory, "catalog.json");
    fs.writeFileSync(output, JSON.stringify(catalog, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        catalog: output,
        method: "fetch",
        categories: extracted.categories.length,
        products: extracted.items.length,
        exclusions: extracted.exclusions,
      }),
    );
    return;
  }
  if (args.action === "start") {
    const request = plan();
    const attempt = {
      requestedAt: new Date().toISOString(),
      status: "STARTING",
      request,
    };
    fs.writeFileSync(attemptPath, JSON.stringify(attempt, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    // A failed or ambiguous POST remains recorded. Collection never starts another paid run.
    const result = await tinyfish(key, "/v1/automation/run-async", request);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(result.run_id ?? ""))
      throw new Error("TinyFish did not return a valid run ID.");
    fs.writeFileSync(
      attemptPath,
      JSON.stringify(
        { ...attempt, status: "STARTED", runId: result.run_id },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        job: args.job,
        runId: result.run_id,
        status: "STARTED",
      }),
    );
    return;
  }
  const attempt = JSON.parse(fs.readFileSync(attemptPath));
  if (
    attempt.status !== "STARTED" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(attempt.runId ?? "")
  )
    throw new Error(
      "No confirmed TinyFish run ID in the saved attempt. Review the account before any retry.",
    );
  const run = await tinyfish(
    key,
    "/v1/runs/" + attempt.runId + "?screenshots=none&html=none",
  );
  if (run.run_id !== attempt.runId)
    throw new Error("TinyFish returned a different run ID.");
  console.log(JSON.stringify({ runId: run.run_id, status: run.status }));
  if (["PENDING", "RUNNING"].includes(run.status)) return;
  const raw = Buffer.from(JSON.stringify(run, null, 2));
  const rawPath = path.join(directory, "tinyfish-result.json");
  if (!fs.existsSync(rawPath))
    fs.writeFileSync(rawPath, raw, { flag: "wx", mode: 0o600 });
  const saved = fs.readFileSync(rawPath);
  const catalog = catalogFromRun(JSON.parse(saved), saved);
  const output = path.join(directory, "catalog.json");
  if (!fs.existsSync(output))
    fs.writeFileSync(output, JSON.stringify(catalog, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  console.log(
    JSON.stringify({
      catalog: output,
      categories: catalog.catalog.categories.length,
      products: catalog.catalog.items.length,
      exclusions: catalog.catalog.exclusions,
    }),
  );
}

module.exports = { plan, parseArgs, catalogFromRun, providerSchema };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
