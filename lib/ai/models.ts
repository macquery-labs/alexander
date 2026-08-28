/**
 * Client-safe model constants. Anything that talks to a provider lives in
 * `lib/ai/providers/`, which is server-only.
 */
export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

/**
 * Model ids are namespaced `provider/modelName`, the same single string that is
 * stored per role. Bare ids are read as gateway ids, so anything written before
 * namespacing still resolves.
 */
export const DEFAULT_CHAT_MODEL = "gateway/moonshotai/kimi-k2.5";

/** Default for the title role; overridable from Settings like any other role. */
export const DEFAULT_TITLE_MODEL = "gateway/moonshotai/kimi-k2.5";

export const isDemo = process.env.IS_DEMO === "1";

/** The curated gateway line-up. Other providers discover their own models. */
export const chatModels: ChatModel[] = [
  {
    description: "Fast and capable model with tool use",
    gatewayOrder: ["bedrock", "deepinfra"],
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
  },
  {
    description: "Moonshot AI flagship model",
    gatewayOrder: ["fireworks", "bedrock"],
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
  },
  {
    description: "Compact reasoning model",
    gatewayOrder: ["groq", "bedrock"],
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "openai",
    reasoningEffort: "low",
  },
  {
    description: "Open-source 120B parameter model",
    gatewayOrder: ["fireworks", "bedrock"],
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    reasoningEffort: "low",
  },
  {
    description: "Fast non-reasoning model with tool use",
    gatewayOrder: ["xai"],
    id: "xai/grok-4.1-fast-non-reasoning",
    name: "Grok 4.1 Fast",
    provider: "xai",
  },
];
