/* eslint-disable @typescript-eslint/no-require-imports -- Offline Git guard fixtures. */
const assert = require("node:assert/strict");
const { privatePath } = require("./team-check.cjs");
const allowed = [".env.example", "src/app/page.tsx", "src/lib/aws/bedrock.ts", "infra/aws/target.example.json",
  "infra/aws/stack.json", "docs/graduation/aws-readiness.md", ".agents/skills/kfc-team-development/SKILL.md",
  ".github/workflows/ci.yml", "package-lock.json"];
const blocked = [".env", ".env.local", "src/.env.secret", ".env.example.backup", "nested/.env.example",
  ".local/preview/store.json", ".AWS/credentials", "output/verification/check.log", ".next/server/app.js",
  "node_modules/package/index.js", "nested/.kfc-restore-old/data.json", "src/STORE.JSON", "session-secret",
  "admin-credentials.json", "admin-bootstrap.txt", "private.pem", "private.key", "backup.kfcbackup",
  "infra/aws/target.json", "infra/aws/target.local.json", "runtime.env", "nginx.conf",
  "nested\\.local\\store.json", "coverage/results.json"];
for (const filename of allowed) assert.equal(privatePath(filename), null, `Safe path blocked: ${filename}`);
for (const filename of blocked) assert.ok(privatePath(filename), `Private path allowed: ${filename}`);
console.log(`Git path guard: ${allowed.length + blocked.length} synthetic path cases passed. No file or cloud mutations.`);
