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

export function getDynamoDBClient() {
  if (!client) {
    client = new DynamoDBClient({
      region: process.env.AWS_REGION || "ap-southeast-1",
    });
  }
  return client;
}

export function getDynamoDBDocumentClient() {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoDBClient());
  }
  return documentClient;
}

export { GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand };

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "KfcForceAgent";
