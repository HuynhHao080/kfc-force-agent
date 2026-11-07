/* eslint-disable @typescript-eslint/no-require-imports -- Shared Node-only password KDF used by server and setup CLI. */
const { scrypt, scryptSync } = require("node:crypto");
const CURRENT_KDF = "scrypt-32768-8-3";
function options(kdf) {
  if (kdf === CURRENT_KDF)
    return { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
  if (kdf === "scrypt-legacy")
    return { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
  throw new Error("Unsupported password KDF");
}
function deriveSync(password, salt, kdf = CURRENT_KDF) {
  return scryptSync(password, salt, 64, options(kdf));
}
function derive(password, salt, kdf = CURRENT_KDF) {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options(kdf), (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
module.exports = { CURRENT_KDF, derive, deriveSync };
