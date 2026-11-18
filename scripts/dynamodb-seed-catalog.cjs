/* eslint-disable @typescript-eslint/no-require-imports -- Loads the reviewed KFC catalog snapshot into the DynamoDB table. */
// Usage: node scripts/dynamodb-seed-catalog.cjs [--catalog path/to/catalog.json]
// Writes categories and items through DynamoDBMenuRepository (same key schema as
// the application). Idempotent: re-running overwrites the same keys. Requires
// DYNAMODB_ENDPOINT (DynamoDB Local) or an approved AWS table via --approve-aws.
process.env.PERSISTENCE_DRIVER = "dynamodb";
require("./register-typescript.cjs");
const fs = require("node:fs");
const path = require("node:path");
const { catalogRecords } = require("../src/lib/catalog/kfc-catalog.ts");
const { DynamoDBMenuRepository } = require("../src/lib/db/repositories/implementations/dynamodb-repository.ts");

async function main() {
  const args = process.argv.slice(2);
  let file = path.join(__dirname, "../src/lib/catalog/kfc-menu.snapshot.json");
  let approve = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--catalog" && args[i + 1]) file = path.resolve(args[++i]);
    else if (args[i] === "--approve-aws" && args[i + 1]) approve = args[++i];
    else throw new Error("Unknown argument: " + args[i]);
  }
  if (!process.env.DYNAMODB_ENDPOINT && !/^\d{12}$/.test(approve ?? ""))
    throw new Error("Refusing to write to real AWS without --approve-aws <account id>.");
  const records = catalogRecords(JSON.parse(fs.readFileSync(file, "utf8")));
  const menu = new DynamoDBMenuRepository();
  for (const category of records.categories) await menu.saveCategory(category);
  for (const item of records.items) await menu.saveMenuItem(item);
  const stored = await menu.getAvailableMenuItems();
  console.log(`Seeded ${records.categories.length} categories and ${records.items.length} items from ${path.relative(process.cwd(), file)}; ${stored.length} items available in ${process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent"}.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
