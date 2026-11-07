/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local setup utility. */
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { CURRENT_KDF, deriveSync } = require("../src/lib/password-crypto.cjs");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
const directory = path.resolve(process.env.LOCAL_DATA_DIR || ".local");
fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, "admin-credentials.json");
if (fs.existsSync(file) && !args.includes("--reset")) {
  console.error(
    "Admin is already configured. Use --reset explicitly to replace the local password and invalidate staff sessions.",
  );
  process.exitCode = 1;
} else {
  const password = args.includes("--password-stdin")
    ? fs.readFileSync(0, "utf8").trim()
    : randomBytes(20).toString("base64url");
  if (password.length < 12 || password.length > 128)
    throw new Error("Password must have 12–128 characters");
  const salt = randomBytes(32).toString("hex");
  const config = {
    salt,
    hash: deriveSync(password, salt).toString("hex"),
    kdf: CURRENT_KDF,
  };
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(config), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
  if (!args.includes("--password-stdin")) {
    const bootstrap = path.join(directory, "admin-bootstrap.txt");
    fs.writeFileSync(bootstrap, password + "\n", { mode: 0o600 });
    console.log(`Local admin password saved privately to: ${bootstrap}`);
  }
  console.log(`Credentials configured at: ${file}`);
  if (process.env.ADMIN_PASSWORD)
    console.log(
      "ADMIN_PASSWORD is set and takes precedence over the local credentials file.",
    );
}
