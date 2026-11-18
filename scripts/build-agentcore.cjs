/* eslint-disable @typescript-eslint/no-require-imports -- Offline build of the AgentCore direct-code deployment package. No AWS calls. */
// Produces dist/agentcore/agent.js (single CommonJS bundle, Node 22, no native
// modules) and dist/agentcore/deployment_package.zip for AgentCore Runtime
// direct code deployment (entryPoint ["agent.js"], runtime NODE_22).
//   npm run agentcore:build
// The bundle reads configuration from environment variables only; no .env file
// is included. Upload and CreateAgentRuntime are separate, approved steps.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist", "agentcore");
const bundle = path.join(outDir, "agent.js");
const archive = path.join(outDir, "deployment_package.zip");
const MAX_ZIP_BYTES = 250 * 1024 * 1024;

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const result = await esbuild.build({
    entryPoints: [path.join(root, "src/agentcore/main.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: bundle,
    metafile: true,
    logLevel: "warning",
    legalComments: "none",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const inputs = Object.keys(result.metafile.inputs);
  const native = inputs.filter((file) => /\.(node|so)$/.test(file));
  if (native.length) throw new Error("Native modules are not allowed in the AgentCore bundle: " + native.join(", "));
  const packages = new Set(inputs.map((file) => file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean));
  fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify({
    name: "kfc-agentcore-runtime", private: true, version: require(path.join(root, "package.json")).version,
    main: "agent.js", engines: { node: ">=22" },
  }, null, 2) + "\n");
  // AgentCore accepts the ZIP from S3; Windows has no `zip`, so use the OS archiver.
  if (process.platform === "win32") {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `Compress-Archive -Force -Path '${bundle}','${path.join(outDir, "package.json")}' -DestinationPath '${archive}'`], { stdio: "inherit" });
  } else {
    execFileSync("zip", ["-j", "-q", archive, bundle, path.join(outDir, "package.json")], { stdio: "inherit" });
  }
  const zipBytes = fs.statSync(archive).size;
  if (zipBytes > MAX_ZIP_BYTES) throw new Error("deployment_package.zip exceeds the 250 MB AgentCore limit.");
  fs.writeFileSync(path.join(outDir, "build-info.json"), JSON.stringify({
    builtAt: new Date().toISOString(),
    entryPoint: ["agent.js"],
    runtime: "NODE_22",
    bundleBytes: fs.statSync(bundle).size,
    zipBytes,
    packages: [...packages].sort(),
    nativeModules: [],
  }, null, 2) + "\n");
  console.log(`agent.js ${(fs.statSync(bundle).size / 1048576).toFixed(2)} MB, deployment_package.zip ${(zipBytes / 1048576).toFixed(2)} MB, ${packages.size} packages, 0 native modules -> ${path.relative(root, outDir)}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
