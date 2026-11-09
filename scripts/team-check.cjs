/* eslint-disable @typescript-eslint/no-require-imports -- Local Git handoff guard. */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

function privatePath(filename) {
  const parts = filename.replaceAll("\\", "/").toLowerCase().split("/");
  const leaf = parts.at(-1);
  if (parts.some(part => [".local", ".aws", ".git", ".next", "node_modules", "output", ".playwright-cli", "__pycache__", "coverage"].includes(part) || part.startsWith(".kfc-restore-")))
    return "runtime, credentials or generated folder";
  if (leaf.startsWith(".env") && filename !== ".env.example") return "environment file";
  if (["store.json", "session-secret", "admin-credentials.json", "admin-bootstrap.txt", "runtime.env", "nginx.conf"].includes(leaf))
    return "runtime data or materialized secret configuration";
  if (/\.(pem|key|p12|pfx|kfcbackup)$/.test(leaf)) return "key or backup file";
  if (parts.slice(0, 2).join("/") === "infra/aws" && /^target.*\.json$/.test(leaf) && leaf !== "target.example.json")
    return "private AWS target; keep it under .local";
  return null;
}

const SECRET_PATTERNS = [
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

function secretInContent(content) {
  if (typeof content !== "string") return null;
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) return name;
  }
  return null;
}

function main() {
  const root = path.resolve(__dirname, "..");
  const files = execFileSync("git", ["ls-files", "--cached", "-z"], {
    cwd: root, encoding: "utf8", windowsHide: true,
  }).split("\0").filter(Boolean);
  const blocked = files.map(filename => ({ filename, reason: privatePath(filename) })).filter(entry => entry.reason);
  if (blocked.length) {
    console.error("Private paths found in Git index (no files were modified):");
    for (const entry of blocked) console.error(`${entry.filename}: ${entry.reason}`);
    process.exitCode = 1;
    return;
  }
  const stagedDiff = execFileSync("git", ["diff", "--cached", "--no-color"], {
    cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 50 * 1024 * 1024,
  });
  const secret = secretInContent(stagedDiff);
  if (secret) {
    console.error(`High-confidence secret pattern found in staged diff: ${secret}. Remove it and rotate if already pushed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Git path guard passed for ${files.length} tracked/staged paths. Staged content scanned for high-confidence secrets; Git history was not scanned.`);
}

module.exports = { privatePath, secretInContent };
if (require.main === module) main();
