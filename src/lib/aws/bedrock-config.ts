import type { BedrockConfig } from "./bedrock";

// Team standard (PR #10): Claude Haiku 5.5 via global inference, Singapore region.
// Values are documented defaults only. Runtime stays fail-closed: BedrockService
// rejects a missing BEDROCK_MODEL_ID or AWS_REGION instead of guessing.
export const DEFAULT_HAIKU_MODEL_ID = "global.anthropic.claude-haiku-5-5";
export const DEFAULT_BEDROCK_REGION = "ap-southeast-1";

type Environment = Record<string, string | undefined>;

export interface ResolvedBedrockConfig extends BedrockConfig {
  region?: string;
}

/** Reads configuration from the environment without inventing model or region. */
export function resolveBedrockConfig(env: Environment = process.env): ResolvedBedrockConfig {
  const region = env.AWS_REGION?.trim();
  return {
    modelId: (env.BEDROCK_MODEL_ID ?? "").trim(),
    region: region || undefined,
    maxTokens: 2048,
  };
}

export function isHaiku55(modelId: string): boolean {
  return /claude-haiku-5-5/.test(modelId);
}

export function bedrockConfigIssue(config: ResolvedBedrockConfig): string | null {
  if (!config.modelId.trim() || config.modelId === "mock-model")
    return "BEDROCK_MODEL_ID must be explicitly configured for the Bedrock provider.";
  if (!config.region)
    return "AWS_REGION must be explicitly configured for the Bedrock provider.";
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(config.region))
    return "AWS_REGION must be a valid AWS region identifier.";
  if (config.maxTokens !== undefined && (!Number.isInteger(config.maxTokens) || config.maxTokens < 1 || config.maxTokens > 2048))
    return "maxTokens must be an integer from 1 to 2048.";
  if (isHaiku55(config.modelId) && (config.temperature !== undefined || config.topP !== undefined))
    return "Haiku 5.5 does not accept sampling parameters.";
  return null;
}

/** Local configuration inspection only. Never resolves credentials or invokes AWS. */
export function getOfflineLlmStatus(env: Environment = process.env) {
  const provider = (env.AI_PROVIDER || "mock").toLowerCase();
  const config = resolveBedrockConfig(env);
  const issue = provider === "mock" ? null : provider === "bedrock"
    ? bedrockConfigIssue(config) : "Unknown AI_PROVIDER.";
  const readOnly = provider === "bedrock" && env.KFC_AGENT_MODE === "read-only";
  return {
    check: "offline_configuration",
    provider,
    mode: provider === "bedrock" ? (readOnly ? "read_only" : "purchase_assistant") : "mock",
    modelId: provider === "bedrock" ? config.modelId : null,
    region: provider === "bedrock" ? config.region ?? null : null,
    configValid: issue === null,
    issue,
    credentials: "not_checked_offline",
    accountModelAccess: "not_checked_offline",
    liveInference: "not_run",
    limits: {
      maxCallsPerMessage: readOnly ? 2 : 1,
      maxOutputTokensPerCall: 2048,
      retries: 0,
      dailyRequestLimit: Number(env.BEDROCK_DAILY_REQUEST_LIMIT ?? "25"),
    },
  };
}
