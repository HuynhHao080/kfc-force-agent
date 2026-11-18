/* eslint-disable @typescript-eslint/no-require-imports -- DynamoDB table lifecycle for the single-table design. */
// Usage:
//   node scripts/dynamodb-table.cjs create|describe|delete [--table KfcForceAgent]
// Offline target: set DYNAMODB_ENDPOINT=http://127.0.0.1:8000 (DynamoDB Local).
// Real AWS writes (create/delete without DYNAMODB_ENDPOINT) require the explicit
// flag --approve-aws <12-digit account id>, matching the team rule that cloud
// writes happen only within an approved scope. `describe` is read-only.
const {
  DynamoDBClient, CreateTableCommand, DescribeTableCommand, DeleteTableCommand, waitUntilTableExists, waitUntilTableNotExists,
} = require("@aws-sdk/client-dynamodb");
const { STSClient, GetCallerIdentityCommand } = (() => { try { return require("@aws-sdk/client-sts"); } catch { return {}; } })();

function parse(argv) {
  const [action, ...rest] = argv;
  const options = { table: process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent", approve: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--table" && rest[i + 1]) options.table = rest[++i];
    else if (rest[i] === "--approve-aws" && rest[i + 1]) options.approve = rest[++i];
    else throw new Error("Unknown argument: " + rest[i]);
  }
  if (!["create", "describe", "delete"].includes(action)) throw new Error("Action must be create, describe or delete.");
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(options.table)) throw new Error("Invalid table name.");
  return { action, ...options };
}

function client() {
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  return new DynamoDBClient({
    region: process.env.AWS_REGION || "ap-southeast-1",
    ...(endpoint ? { endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } } : {}),
  });
}

async function main() {
  const { action, table, approve } = parse(process.argv.slice(2));
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
  const target = endpoint ? `local endpoint ${endpoint}` : `AWS ${process.env.AWS_REGION || "ap-southeast-1"}`;
  if (!endpoint && action !== "describe") {
    if (!/^\d{12}$/.test(approve ?? "")) throw new Error(`Refusing to ${action} a table on real AWS without --approve-aws <account id>.`);
    if (!STSClient) throw new Error("@aws-sdk/client-sts is required to verify the approved account.");
    const identity = await new STSClient({ region: process.env.AWS_REGION || "ap-southeast-1" }).send(new GetCallerIdentityCommand({}));
    if (identity.Account !== approve) throw new Error(`Credentials belong to account ${identity.Account}, not the approved ${approve}.`);
  }
  const db = client();
  if (action === "describe") {
    const { Table } = await db.send(new DescribeTableCommand({ TableName: table }));
    console.log(JSON.stringify({ target, table: Table.TableName, status: Table.TableStatus, items: Table.ItemCount, keySchema: Table.KeySchema, billing: Table.BillingModeSummary?.BillingMode }, null, 2));
    return;
  }
  if (action === "create") {
    await db.send(new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }, { AttributeName: "SK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }, { AttributeName: "SK", KeyType: "RANGE" }],
      BillingMode: "PAY_PER_REQUEST",
      DeletionProtectionEnabled: !endpoint,
      Tags: [{ Key: "Project", Value: "kfc" }, { Key: "Component", Value: "agent-data" }],
    }));
    await waitUntilTableExists({ client: db, maxWaitTime: 120 }, { TableName: table });
    console.log(`Created table ${table} on ${target} (PK/SK, on-demand, Project=kfc${endpoint ? "" : ", deletion protection on"}).`);
    return;
  }
  await db.send(new DeleteTableCommand({ TableName: table }));
  await waitUntilTableNotExists({ client: db, maxWaitTime: 120 }, { TableName: table });
  console.log(`Deleted table ${table} on ${target}.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
