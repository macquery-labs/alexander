import type { JSONValue } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ModelAvailability = "healthy" | "impacted" | "unknown";

export const MODEL_PROVIDER_IDS = ["gateway", "ollama", "mock"] as const;

export type ModelProviderId = (typeof MODEL_PROVIDER_IDS)[number];

export function isModelProviderId(value: string): value is ModelProviderId {
  return (MODEL_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * One model as the picker and the settings UI see it. `id` is namespaced so two
 * providers can serve the same underlying name without colliding; `modelId` is
 * what the provider itself is asked for.
 */
export type CatalogueModel = {
  id: string;
  modelId: string;
  providerId: ModelProviderId;
  name: string;
  description: string;
  /** Logo key for models.dev, e.g. "moonshotai". */
  owner: string;
  capabilities: ModelCapabilities;
  /**
   * False when the provider can list this model but not run it — the gateway
   * without credentials, say. Listed, but shown as unusable rather than
   * silently missing.
   */
  callable: boolean;
  /** Why it cannot be called, shown in the picker. */
  unavailableReason?: string;
};

/** Matches the AI SDK's `providerOptions`: a JSON object per provider name. */
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

export type ModelProvider = {
  readonly id: ModelProviderId;
  readonly label: string;
  /** Models this provider can currently serve. Never throws; returns [] instead. */
  listModels: () => Promise<CatalogueModel[]>;
  languageModel: (modelId: string) => LanguageModel;
  /** Per-provider `streamText` options, e.g. gateway routing order. */
  providerOptions?: (modelId: string) => ProviderOptions | undefined;
  availability?: (modelId: string) => Promise<ModelAvailability>;
};
