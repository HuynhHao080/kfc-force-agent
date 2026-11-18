import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBDocumentClient } from "./dynamodb";

export interface BudgetReservation { day: string; used: number; limit: number }

function configuredLimit(): number {
  const configured = process.env.BEDROCK_DAILY_REQUEST_LIMIT ?? "25";
  if (!/^\d+$/.test(configured) || Number(configured) > 1000)
    throw new Error("BEDROCK_DAILY_REQUEST_LIMIT must be an integer from 0 to 1000.");
  const limit = Number(configured);
  if (!limit) throw new Error("Bedrock inference is disabled by the request budget.");
  return limit;
}

/** A persisted request ceiling for the single-process AWS deployment. */
export function reserveBedrockInvocation(directory = process.env.LOCAL_DATA_DIR || ".local", now = new Date()): BudgetReservation {
  const limit = configuredLimit();
  const day = now.toISOString().slice(0, 10);
  const root = resolve(/* turbopackIgnore: true */ directory);
  mkdirSync(root, { recursive: true });
  const file = resolve(root, "bedrock-usage.json");
  let used = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (!saved || !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) ||
        !Number.isFinite(Date.parse(saved.day + "T00:00:00.000Z")) ||
        new Date(saved.day + "T00:00:00.000Z").toISOString().slice(0, 10) !== saved.day ||
        !Number.isSafeInteger(saved.used) || saved.used < 0 || saved.day > day)
      throw new Error("The Bedrock request budget file is invalid.");
    if (saved.day === day) used = saved.used;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // RANG BUỘC: fonction này được thiết kế cho MỘT TIẾN TRÌNH duyệt (single-process),
  // không hỗ trợ nhiều process đồng thời. Read-modify-write trên file JSON không có
  // file locking, không thay thế được atomic locking. Nếu cần multi-process, phải
  // bổ sung cơ chế khóa nguyên tại lớp triển khai AWS.
  if (used >= limit) throw new Error("The daily Bedrock request ceiling has been reached.");
  const temporary = file + ".tmp";
  writeFileSync(temporary, JSON.stringify({ day, used: used + 1 }) + "\n", { mode: 0o600 });
  renameSync(temporary, file);
  return { day, used: used + 1, limit };
}

/**
 * Multi-process ceiling for AgentCore / Lambda: one conditional atomic
 * counter per UTC day in the application's DynamoDB table
 * (PK = BEDROCK_BUDGET, SK = <day>). The condition makes the reservation
 * fail closed: concurrent sessions can never exceed the limit together.
 */
export async function reserveBedrockInvocationDynamoDB(now = new Date()): Promise<BudgetReservation> {
  const limit = configuredLimit();
  const day = now.toISOString().slice(0, 10);
  try {
    const result = await getDynamoDBDocumentClient().send(new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent",
      Key: { PK: "BEDROCK_BUDGET", SK: day },
      UpdateExpression: "ADD #used :one SET #limit = :limit, #updatedAt = :now",
      ConditionExpression: "attribute_not_exists(#used) OR #used < :limit",
      ExpressionAttributeNames: { "#used": "used", "#limit": "limit", "#updatedAt": "updatedAt" },
      ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":now": now.toISOString() },
      ReturnValues: "ALL_NEW",
    }));
    return { day, used: Number(result.Attributes?.used ?? 1), limit };
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException")
      throw new Error("The daily Bedrock request ceiling has been reached.");
    throw error;
  }
}

/** Picks the store that matches the persistence driver; DynamoDB when the app data lives there. */
export function reserveInvocation(now = new Date()): Promise<BudgetReservation> {
  const store = (process.env.BEDROCK_BUDGET_STORE || process.env.PERSISTENCE_DRIVER || "local").toLowerCase();
  return store === "dynamodb"
    ? reserveBedrockInvocationDynamoDB(now)
    : Promise.resolve(reserveBedrockInvocation(undefined, now));
}
