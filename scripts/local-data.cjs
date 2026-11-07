/* eslint-disable @typescript-eslint/no-require-imports -- Local offline data utility. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { CURRENT_KDF, deriveSync } = require("../src/lib/password-crypto.cjs");
const FILES = ["store.json", "session-secret", "admin-credentials.json"];
const MAX_FILE = 20 * 1024 * 1024;
const MAX_ARCHIVE = 64 * 1024 * 1024;
const FIELDS = {
  accountRepository: ["authSessions", "accounts", "emails"],
  userRepository: ["users", "userProfiles", "userPreferences", "addresses"],
  sessionRepository: ["sessions", "messages", "conversationContexts"],
  menuRepository: [
    "categories",
    "items",
    "itemOptions",
    "optionValues",
    "bundles",
    "bundleItems",
    "catalogAudit",
    "promotions",
    "shopSettings",
  ],
  cartRepository: ["carts", "cartItems"],
  orderRepository: ["orders", "orderItems", "orderEvents"],
};
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function parseJson(data, message) {
  try {
    return JSON.parse(data.toString("utf8"));
  } catch {
    throw new Error(message);
  }
}
const exists = (file) => {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};
function readRegular(file, maximum = MAX_FILE) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum)
    throw new Error("Expected a regular file within the size limit.");
  const data = fs.readFileSync(file);
  if (data.length > maximum) throw new Error("File exceeds the size limit.");
  return data;
}
function validateSnapshot(data) {
  const snapshot = parseJson(data, "Local snapshot is not valid JSON.");
  if (
    !object(snapshot) ||
    Object.keys(snapshot).length !== Object.keys(FIELDS).length ||
    Object.keys(FIELDS).some((name) => !Object.hasOwn(snapshot, name))
  )
    throw new Error("Invalid local snapshot.");
  for (const [repository, fields] of Object.entries(snapshot)) {
    if (!Object.hasOwn(FIELDS, repository) || !object(fields))
      throw new Error("Unsupported snapshot repository.");
    if (
      FIELDS[repository].some(
        (name) =>
          !["catalogAudit", "promotions", "shopSettings"].includes(name) &&
          !Object.hasOwn(fields, name),
      )
    )
      throw new Error("Snapshot is missing a required map.");
    for (const [field, entries] of Object.entries(fields)) {
      if (
        !FIELDS[repository].includes(field) ||
        !Array.isArray(entries) ||
        entries.some(
          (entry) =>
            !Array.isArray(entry) ||
            entry.length !== 2 ||
            typeof entry[0] !== "string",
        )
      )
        throw new Error("Invalid snapshot map.");
      if (new Set(entries.map((entry) => entry[0])).size !== entries.length)
        throw new Error("Duplicate snapshot map keys.");
    }
  }
}
function validateFile(name, data) {
  if (name === "store.json") validateSnapshot(data);
  if (name === "session-secret" && data.toString("utf8").length < 32)
    throw new Error("Invalid signing secret.");
  if (name === "admin-credentials.json") {
    const entry = parseJson(data, "Admin credential file is not valid JSON.");
    if (
      !object(entry) ||
      typeof entry.salt !== "string" ||
      typeof entry.hash !== "string" ||
      !/^[a-f0-9]{128}$/i.test(entry.hash) ||
      !entry.salt ||
      (entry.kdf !== undefined &&
        ![CURRENT_KDF, "scrypt-legacy"].includes(entry.kdf))
    )
      throw new Error("Invalid admin credentials.");
  }
}
function passwordCheck(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("Backup password must contain 12–128 characters.");
}
function aad(header) {
  return Buffer.from(
    JSON.stringify({
      format: header.format,
      version: header.version,
      createdAt: header.createdAt,
      kdf: header.kdf,
    }),
  );
}
function encrypt(payload, password) {
  passwordCheck(password);
  const header = {
    format: "kfc-local-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    kdf: CURRENT_KDF,
  };
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = deriveSync(password, salt).subarray(0, 32);
  try {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad(header));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(payload))),
      cipher.final(),
    ]);
    return Buffer.from(
      JSON.stringify({
        ...header,
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      }),
    );
  } finally {
    key.fill(0);
  }
}
function base64(text, size) {
  if (typeof text !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error("Invalid backup encoding.");
  const bytes = Buffer.from(text, "base64");
  if (
    bytes.toString("base64") !== text ||
    (size !== undefined && bytes.length !== size)
  )
    throw new Error("Invalid backup encoding.");
  return bytes;
}
function decrypt(data, password) {
  passwordCheck(password);
  if (data.length > MAX_ARCHIVE)
    throw new Error("Backup exceeds the size limit.");
  const header = parseJson(data, "Backup is not valid JSON.");
  if (
    !object(header) ||
    header.format !== "kfc-local-backup" ||
    header.version !== 1 ||
    header.kdf !== CURRENT_KDF ||
    typeof header.createdAt !== "string" ||
    !Number.isFinite(Date.parse(header.createdAt))
  )
    throw new Error("Unsupported backup format.");
  const key = deriveSync(password, base64(header.salt, 32)).subarray(0, 32);
  try {
    const cipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      base64(header.iv, 12),
    );
    cipher.setAAD(aad(header));
    cipher.setAuthTag(base64(header.tag, 16));
    let plaintext;
    try {
      plaintext = Buffer.concat([
        cipher.update(base64(header.ciphertext)),
        cipher.final(),
      ]);
    } catch {
      throw new Error("Wrong backup password or modified backup.");
    }
    let payload;
    try {
      payload = parseJson(plaintext, "Invalid backup payload.");
    } finally {
      plaintext.fill(0);
    }
    if (
      !object(payload) ||
      payload.version !== 1 ||
      typeof payload.sourceVersion !== "string" ||
      !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(payload.sourceVersion) ||
      !Array.isArray(payload.files) ||
      payload.files.length < 2 ||
      payload.files.length > 3
    )
      throw new Error("Invalid backup manifest.");
    const names = new Set();
    const files = payload.files.map((entry) => {
      if (
        !object(entry) ||
        !FILES.includes(entry.name) ||
        names.has(entry.name) ||
        typeof entry.sha256 !== "string" ||
        !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 0 ||
        entry.bytes > MAX_FILE
      )
        throw new Error("Invalid or unsafe backup file.");
      names.add(entry.name);
      const content = base64(entry.data);
      if (content.length !== entry.bytes || hash(content) !== entry.sha256)
        throw new Error("Backup file hash mismatch.");
      validateFile(entry.name, content);
      return { name: entry.name, data: content };
    });
    if (!names.has("store.json") || !names.has("session-secret"))
      throw new Error("Backup is missing required data.");
    return { payload, files };
  } finally {
    key.fill(0);
  }
}
function backup(source, output, password, env = process.env) {
  source = path.resolve(source);
  output = path.resolve(output);
  if (!output.endsWith(".kfcbackup"))
    throw new Error("Output must end with .kfcbackup.");
  if (exists(output)) throw new Error("Backup destination already exists.");
  const captures = [];
  const disk = new Map();
  for (const name of FILES) {
    const file = path.join(source, name);
    if (name === "session-secret" && env.SESSION_SECRET) {
      const data = Buffer.from(env.SESSION_SECRET);
      validateFile(name, data);
      captures.push({
        name,
        bytes: data.length,
        sha256: hash(data),
        data: data.toString("base64"),
      });
      continue;
    }
    if (!exists(file)) {
      if (name === "admin-credentials.json") {
        disk.set(name, null);
        continue;
      }
      throw new Error("Required local file is missing: " + name);
    }
    const data = readRegular(file);
    validateFile(name, data);
    disk.set(name, hash(data));
    captures.push({
      name,
      bytes: data.length,
      sha256: hash(data),
      data: data.toString("base64"),
    });
  }
  // Detect changes during collection. Stop the app for a coordinated backup.
  for (const [name, expected] of disk) {
    const file = path.join(source, name);
    if (
      expected === null
        ? exists(file)
        : !exists(file) || hash(readRegular(file)) !== expected
    )
      throw new Error(
        "Source changed during backup. Stop the application and try again.",
      );
  }
  const data = encrypt(
    {
      version: 1,
      sourceVersion: require("../package.json").version,
      signingSecretSource: env.SESSION_SECRET ? "environment" : "file",
      adminCredentialSource: env.ADMIN_PASSWORD
        ? "environment-override-not-copied"
        : "file-or-unconfigured",
      files: captures,
    },
    password,
  );
  if (data.length > MAX_ARCHIVE)
    throw new Error("Backup exceeds the size limit.");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, data, { flag: "wx", mode: 0o600 });
  return {
    operation: "backup",
    output,
    files: captures.length,
    bytes: data.length,
    encrypted: true,
  };
}
function verify(file, password) {
  const { payload, files } = decrypt(
    readRegular(path.resolve(file), MAX_ARCHIVE),
    password,
  );
  return {
    operation: "verify",
    valid: true,
    files: files.length,
    sourceVersion: payload.sourceVersion,
  };
}
function restore(file, target, password, env = process.env) {
  target = path.resolve(target);
  if (exists(target))
    throw new Error(
      "Restore requires a new, nonexistent destination. Existing data is never overwritten.",
    );
  const { files } = decrypt(
    readRegular(path.resolve(file), MAX_ARCHIVE),
    password,
  );
  const secret = files
    .find((entry) => entry.name === "session-secret")
    .data.toString("utf8");
  if (env.SESSION_SECRET && env.SESSION_SECRET !== secret)
    throw new Error(
      "SESSION_SECRET override differs from the backup. Use the restored file secret or matching configuration.",
    );
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = fs.mkdtempSync(path.join(parent, ".kfc-restore-"));
  try {
    for (const entry of files) {
      const destination = path.join(stage, entry.name);
      fs.writeFileSync(destination, entry.data, { flag: "wx", mode: 0o600 });
      if (hash(readRegular(destination)) !== hash(entry.data))
        throw new Error("Restored file verification failed.");
    }
    if (exists(target))
      throw new Error("Restore destination appeared during restore.");
    fs.renameSync(stage, target);
  } catch (error) {
    // Only remove the known files from the directory just created by this call.
    if (
      path.dirname(stage) === parent &&
      path.basename(stage).startsWith(".kfc-restore-")
    ) {
      for (const name of FILES) {
        try {
          fs.unlinkSync(path.join(stage, name));
        } catch {
          /* not written */
        }
      }
      try {
        fs.rmdirSync(stage);
      } catch {
        /* leave any unexpected file intact */
      }
    }
    throw error;
  }
  return {
    operation: "restore",
    target,
    files: files.length,
    applicationMustBeRestarted: true,
  };
}
function main() {
  require("@next/env").loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!["backup", "verify", "restore"].includes(command))
    throw new Error(
      "Use backup, verify or restore with --password-stdin. See docs/local-backup.md.",
    );
  const allowed =
    command === "backup"
      ? ["--from", "--out"]
      : command === "verify"
        ? ["--file"]
        : ["--file", "--to"];
  const options = {};
  let stdin = false;
  while (args.length) {
    const name = args.shift();
    if (name === "--password-stdin" && !stdin) {
      stdin = true;
      continue;
    }
    if (
      !allowed.includes(name) ||
      options[name] ||
      !args.length ||
      !args[0] ||
      args[0].startsWith("--")
    )
      throw new Error("Invalid or duplicate command option.");
    options[name] = args.shift();
  }
  if (!stdin)
    throw new Error(
      "Password must be supplied on stdin using --password-stdin; never put it in a command argument.",
    );
  const password = fs.readFileSync(0, "utf8").replace(/[\r\n]+$/, "");
  let result;
  if (command === "backup") {
    const source = options["--from"] || process.env.LOCAL_DATA_DIR || ".local";
    const output =
      options["--out"] ||
      path.join(
        source,
        "backups",
        "kfc-" + Date.now() + "-" + crypto.randomUUID() + ".kfcbackup",
      );
    result = backup(source, output, password);
  } else {
    if (!options["--file"] || (command === "restore" && !options["--to"]))
      throw new Error("Missing --file or --to.");
    result =
      command === "verify"
        ? verify(options["--file"], password)
        : restore(options["--file"], options["--to"], password);
  }
  console.log(JSON.stringify(result));
}
module.exports = {
  backup,
  verify,
  restore,
  encrypt,
  decrypt,
  validateSnapshot,
};
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Local data operation failed: " + error.message);
    process.exitCode = 1;
  }
}
