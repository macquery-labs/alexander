import { gateway, type LanguageModel } from "ai";
import { isTestEnvironment } from "../../constants";
import { type ChatModel, chatModels, isDemo } from "../models";
import type {
  CatalogueModel,
  ModelAvailability,
  ModelCapabilities,
  ModelProvider,
  ProviderOptions,
} from "./types";

const GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";
const CAPABILITY_TTL_SECONDS = 86_400;
const AVAILABILITY_TTL_SECONDS = 60;
/**
 * The catalogue is on the path of every chat request and of the model picker,
 * so a slow gateway must degrade to "capabilities unknown" rather than hold the
 * whole list up. Answers are also kept in-process, so only the first call pays.
 */
const CAPABILITY_TIMEOUT_MS = 3000;
const CAPABILITY_CACHE_TTL_MS = 60 * 60 * 1000;

const NO_CAPABILITIES: ModelCapabilities = {
  reasoning: false,
  tools: false,
  vision: false,
};

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

type GatewayEndpoint = {
  provider_name?: string;
  status?: number;
  uptime_last_15m?: number;
  uptime_last_1h?: number;
  latency_last_1h?: { p50?: number; p95?: number };
};

const PROVIDER_IMPACTED_UPTIME_THRESHOLD = 99;
const PROVIDER_IMPACTED_P50_MS = 10_000;
const PROVIDER_IMPACTED_P95_MS = 30_000;

function isEndpointImpacted(endpoint: GatewayEndpoint) {
  return (
    (endpoint.status !== undefined && endpoint.status !== 0) ||
    (endpoint.uptime_last_15m !== undefined &&
      endpoint.uptime_last_15m < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.uptime_last_1h !== undefined &&
      endpoint.uptime_last_1h < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.latency_last_1h?.p50 !== undefined &&
      endpoint.latency_last_1h.p50 > PROVIDER_IMPACTED_P50_MS) ||
    (endpoint.latency_last_1h?.p95 !== undefined &&
      endpoint.latency_last_1h.p95 > PROVIDER_IMPACTED_P95_MS)
  );
}

const capabilityCache = new Map<
  string,
  { at: number; capabilities: ModelCapabilities }
>();

async function readCapabilities(modelId: string): Promise<ModelCapabilities> {
  const cached = capabilityCache.get(modelId);

  if (cached && Date.now() - cached.at < CAPABILITY_CACHE_TTL_MS) {
    return cached.capabilities;
  }

  try {
    const res = await fetch(`${GATEWAY_BASE}/models/${modelId}/endpoints`, {
      next: { revalidate: CAPABILITY_TTL_SECONDS },
      signal: AbortSignal.timeout(CAPABILITY_TIMEOUT_MS),
    });

    if (!res.ok) {
      return NO_CAPABILITIES;
    }

    const json = await res.json();
    const endpoints = json.data?.endpoints ?? [];
    const params = new Set(
      endpoints.flatMap(
        (e: { supported_parameters?: string[] }) => e.supported_parameters ?? []
      )
    );
    const inputModalities = new Set(
      json.data?.architecture?.input_modalities ?? []
    );

    const capabilities = {
      reasoning: params.has("reasoning"),
      tools: params.has("tools"),
      vision: inputModalities.has("image"),
    };

    capabilityCache.set(modelId, { at: Date.now(), capabilities });

    return capabilities;
  } catch {
    return NO_CAPABILITIES;
  }
}

/** The full gateway catalogue, only listed on the public demo deployment. */
async function readFullCatalogue(): Promise<CatalogueModel[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/models`, {
      next: { revalidate: CAPABILITY_TTL_SECONDS },
      signal: AbortSignal.timeout(CAPABILITY_TIMEOUT_MS),
    });

    if (!res.ok) {
      return [];
    }

    const json = await res.json();

    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        callable: isGatewayCallable(),
        capabilities: {
          reasoning: m.tags?.includes("reasoning") ?? false,
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
        },
        description: "",
        id: `gateway/${m.id}`,
        modelId: m.id,
        name: m.name,
        owner: m.id.split("/")[0] ?? "vercel",
        providerId: "gateway" as const,
      }));
  } catch {
    return [];
  }
}

function toCatalogueModel(
  model: ChatModel,
  capabilities: ModelCapabilities
): CatalogueModel {
  // The catalogue endpoints are public but running a model is not, so the
  // line-up is always shown and marked unusable when there are no credentials.
  const callable = isGatewayCallable();

  return {
    callable,
    capabilities,
    description: model.description,
    id: `gateway/${model.id}`,
    modelId: model.id,
    name: model.name,
    owner: model.provider,
    providerId: "gateway",
    ...(callable
      ? {}
      : { unavailableReason: "Set AI_GATEWAY_API_KEY to use gateway models." }),
  };
}

function isGatewayCallable(): boolean {
  return Boolean(
    isTestEnvironment ||
      process.env.AI_GATEWAY_API_KEY ||
      // Vercel deployments authenticate with an injected OIDC token instead.
      process.env.VERCEL
  );
}

export function createGatewayProvider(): ModelProvider {
  return {
    async availability(modelId: string): Promise<ModelAvailability> {
      try {
        const res = await fetch(`${GATEWAY_BASE}/models/${modelId}/endpoints`, {
          next: { revalidate: AVAILABILITY_TTL_SECONDS },
          signal: AbortSignal.timeout(CAPABILITY_TIMEOUT_MS),
        });

        if (!res.ok) {
          return "unknown";
        }

        const json = await res.json();
        const endpoints = (json.data?.endpoints ?? []) as GatewayEndpoint[];

        if (endpoints.length === 0) {
          return "unknown";
        }

        return endpoints.some(isEndpointImpacted) ? "impacted" : "healthy";
      } catch {
        return "unknown";
      }
    },

    id: "gateway",
    label: "Vercel AI Gateway",

    languageModel(modelId: string): LanguageModel {
      return gateway.languageModel(modelId);
    },

    async listModels(): Promise<CatalogueModel[]> {
      const curated = await Promise.all(
        chatModels.map(async (model) =>
          toCatalogueModel(model, await readCapabilities(model.id))
        )
      );

      if (!isDemo) {
        return curated;
      }

      const curatedIds = new Set(curated.map((model) => model.id));
      const rest = (await readFullCatalogue()).filter(
        (model) => !curatedIds.has(model.id)
      );

      return [...curated, ...rest];
    },

    providerOptions(modelId: string): ProviderOptions | undefined {
      const model = chatModels.find((item) => item.id === modelId);

      if (!model) {
        return;
      }

      return {
        ...(model.gatewayOrder && { gateway: { order: model.gatewayOrder } }),
        ...(model.reasoningEffort && {
          openai: { reasoningEffort: model.reasoningEffort },
        }),
      };
    },
  };
}
