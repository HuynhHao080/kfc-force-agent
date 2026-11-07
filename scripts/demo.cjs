/* eslint-disable @typescript-eslint/no-require-imports -- Local demo command. */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const dataDirectory = path.join(root, ".local", "preview");

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!["start", "setup", "doctor"].includes(command))
    throw new Error("Use demo:start, demo:setup or demo:doctor.");
  if (args.length && (args.length !== 2 || args[0] !== "--port"))
    throw new Error("Only --port <1024..65535> is supported.");
  const port = args.length ? Number(args[1]) : 3100;
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Port must be an integer from 1024 to 65535.");
  if (command === "setup" && args.length)
    throw new Error("demo:setup does not accept a port or reset credentials.");
  const base = "http://127.0.0.1:" + port;
  if (command === "doctor") return doctor(base);
  if (
    command === "start" &&
    !fs.existsSync(path.join(root, ".next", "BUILD_ID"))
  )
    throw new Error("Production build missing. Run npm run build first.");
  console.log(
    "Demo: mock AI, local persistence, .local/preview; no cloud integration.",
  );
  console.log(
    "Using local credential/signing files; environment password/key overrides are disabled.",
  );
  if (command === "start") {
    console.log("Customer: " + base + "/chat | Staff: " + base + "/admin");
    if (!fs.existsSync(path.join(dataDirectory, "admin-credentials.json")))
      console.log(
        "Staff credentials missing: run npm run demo:setup separately.",
      );
  }
  const script =
    command === "setup"
      ? [path.join(__dirname, "admin-setup.cjs")]
      : [
          path.join(root, "node_modules/next/dist/bin/next"),
          "start",
          "--port",
          String(port),
          "--hostname",
          "127.0.0.1",
        ];
  const child = spawn(process.execPath, script, {
    cwd: root,
    env: {
      ...process.env,
      AI_PROVIDER: "mock",
      PERSISTENCE_DRIVER: "local",
      LOCAL_DATA_DIR: dataDirectory,
      ADMIN_PASSWORD: "",
      SESSION_SECRET: "",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", () => {
    console.error("Could not start demo command.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (child.exitCode === null) child.kill(signal);
    });
}

async function doctor(base) {
  const version = require("../package.json").version;
  const probes = [
    [
      "demo health/config",
      "/api/health",
      200,
      async (r) => {
        const h = await r.json();
        return (
          h.status === "ok" &&
          h.version === version &&
          h.mode === "demo" &&
          h.aiProvider === "mock" &&
          h.persistence === "local" &&
          h.cloudVerified === false &&
          h.paymentsEnabled === false
        );
      },
    ],
    [
      "customer page",
      "/chat",
      200,
      async (r) => (await r.text()).includes("KFC Force Agent"),
    ],
    [
      "staff page",
      "/admin",
      200,
      async (r) => (await r.text()).includes("KFC"),
    ],
    ["staff orders require authentication", "/api/admin/orders", 401],
    [
      "addresses require customer authentication",
      "/api/account/addresses",
      401,
    ],
    ["orders require authentication", "/api/orders", 401],
    ["cart requires authentication", "/api/cart", 401],
  ];
  const results = await Promise.all(
    probes.map(async ([name, route, status, inspect]) => {
      try {
        const r = await fetch(base + route, {
          signal: AbortSignal.timeout(5000),
          redirect: "manual",
          cache: "no-store",
        });
        const passed = r.status === status && (!inspect || (await inspect(r)));
        return { name, passed, status: r.status };
      } catch {
        return {
          name,
          passed: false,
          reason: "No valid response within 5 seconds",
        };
      }
    }),
  );
  const passed = results.every((r) => r.passed);
  for (const r of results) console.log((r.passed ? "PASS " : "FAIL ") + r.name);
  const report = {
    checkedAt: new Date().toISOString(),
    target: base,
    version,
    passed,
    scope:
      "Read-only HTTP readiness; no login, mutations, AI calls or full acceptance",
    results,
  };
  const output = path.join(root, "output", "verification");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, "demo-readiness.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Readiness: " +
      (passed ? "PASS" : "FAIL") +
      ". See output/verification/demo-readiness.json",
  );
  if (!passed) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
