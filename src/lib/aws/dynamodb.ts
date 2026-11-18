"use strict";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

let client: DynamoDBClient | undefined;
let documentClient: DynamoDBDocumentClient | undefined;

/**
 * DYNAMODB_ENDPOINT points the client at DynamoDB Local (http://127.0.0.1:8000)
 * for offline verification. It is never set in production, where the runtime
 * role supplies credentials and the regional endpoint is used.
 */
export function getDynamoDBClient() {
  if (!client) {
    const endpoint = process.env.DYNAMODB_ENDPOINT?.trim();
    client = new DynamoDBClient({
      region: process.env.AWS_REGION || "ap-southeast-1",
      ...(endpoint
        ? {
            endpoint,
            // DynamoDB Local accepts any static credentials; keep real ones out of tests.
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
            },
          }
        : {}),
    });
  }
  return client;
}

export function getDynamoDBDocumentClient() {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return documentClient;
}

export { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand };

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent";
