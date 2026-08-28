import "server-only";

import type { LanguageModel } from "ai";
import { isTestEnvironment } from "../../constants";
import { createGatewayProvider } from "./gateway";
import { createMockProvider } from "./mock";
import { createOllamaProvider } from "./ollama";
import {
  type CatalogueModel,
  isModelProviderId,
  type ModelAvailability,
  type ModelProvider,
  type ModelProviderId,
  type ProviderOptions,
} from "./types";

export type {
  CatalogueModel,
  ModelAvailability,
  ModelCapabilities,
  ModelProvider,
  ModelProviderId,
  ProviderOptions,
} from "./types";
export { isModelProviderId, MODEL_PROVIDER_IDS } from "./types";

const DEFAULT_PROVIDER_ID: ModelProviderId = "gateway";

const FACTORIES: Record<ModelProviderId, () => ModelProvider> = {
  gateway: createGatewayProvider,
  mock: createMockProvider,
  ollama: createOllamaProvider,
};

/**
 * Every provider is registered; none is switched on by configuration. Each one
 * reports an empty catalogue when it cannot actually serve anything — the
 * gateway without credentials, Ollama with no reachable server — so what the
 * picker shows is what genuinely works.
 */
const ENABLED_PROVIDER_IDS: ModelProviderId[] = ["gateway", "ollama"];

/**
 * Under test (and under MOCK_AI) the mock answers for every provider, so the
 * catalogue is pinned to the curated gateway line-up. Otherwise the picker
 * would vary with whatever the developer happens to have pulled locally.
 */
function registeredProviderIds(): ModelProviderId[] {
  return isTestEnvironment ? ["gateway"] : ENABLED_PROVIDER_IDS;
}

let cache: Map<ModelProviderId, ModelProvider> | null = null;

function registry(): Map<ModelProviderId, ModelProvider> {
  if (!cache) {
    cache = new Map(
      registeredProviderIds().map((id) => [id, FACTORIES[id]()] as const)
    );
  }

  return cache;
}

export function getModelProviders(): ModelProvider[] {
  return [...registry().values()];
}

export function getModelProvider(
  id: ModelProviderId
): ModelProvider | undefined {
  return registry().get(id);
}

/**
 * Model ids are `provider/modelName`. Gateway names contain slashes of their own
 * (`moonshotai/kimi-k2.5`), so only the first segment is read as a provider, and
 * only when it names one — which also lets a bare id from before namespacing
 * fall through to the gateway.
 */
export function parseModelId(id: string): {
  providerId: ModelProviderId;
  modelId: string;
} {
  const separator = id.indexOf("/");

  if (separator > 0) {
    const candidate = id.slice(0, separator);

    if (isModelProviderId(candidate)) {
      return { modelId: id.slice(separator + 1), providerId: candidate };
    }
  }

  return { modelId: id, providerId: DEFAULT_PROVIDER_ID };
}

export function resolveLanguageModel(id: string): LanguageModel {
  const { modelId, providerId } = parseModelId(id);

  // Under test the mock stands in for every provider, so the suite never needs
  // a gateway key or a running Ollama.
  if (isTestEnvironment) {
    return createMockProvider().languageModel(modelId);
  }

  const provider = getModelProvider(providerId);

  if (!provider) {
    throw new Error(
      `Unknown model provider "${providerId}". Known: ${ENABLED_PROVIDER_IDS.join(", ")}.`
    );
  }

  return provider.languageModel(modelId);
}

export function getProviderOptions(id: string): ProviderOptions | undefined {
  const { modelId, providerId } = parseModelId(id);

  return getModelProvider(providerId)?.providerOptions?.(modelId);
}

export async function getModelAvailability(
  id: string
): Promise<ModelAvailability> {
  const { modelId, providerId } = parseModelId(id);
  const provider = getModelProvider(providerId);

  if (!provider?.availability) {
    return "unknown";
  }

  return await provider.availability(modelId);
}

/** Every model every enabled provider can serve, in provider order. */
export async function getModelCatalogue(): Promise<CatalogueModel[]> {
  const lists = await Promise.all(
    getModelProviders().map(async (provider) => {
      try {
        return await provider.listModels();
      } catch {
        return [];
      }
    })
  );

  return lists.flat();
}
