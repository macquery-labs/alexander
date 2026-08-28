import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type {
  CatalogueModel,
  ModelAvailability,
  ModelCapabilities,
  ModelProvider,
} from "./types";

const TRAILING_SLASHES = /\/+$/;
const LIST_TIMEOUT_MS = 4000;
const SHOW_TIMEOUT_MS = 4000;
const PROBE_TIMEOUT_MS = 700;

const OLLAMA_CLOUD_URL = "https://ollama.com";

/**
 * Where a self-hosted Ollama usually is, in the order worth trying: on this
 * host, on the host of the container this runs in, then the compose service.
 * Probed rather than configured, so one build works natively and in Docker.
 */
const CANDIDATE_BASE_URLS = [
  "http://localhost:11434",
  "http://host.docker.internal:11434",
  "http://ollama:11434",
];

type OllamaTag = {
  model?: string;
  name?: string;
  /** Set when a local server only proxies this model for a remote host. */
  remote_host?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
};

/**
 * A server speaking the Ollama API. Ollama Cloud serves the same `/api/tags`,
 * `/api/show` and OpenAI-compatible `/v1` routes as a local install, so the two
 * are one provider reached at different addresses — which is also how Ollama
 * itself presents cloud models, alongside local ones.
 */
type OllamaHost = {
  label: string;
  descriptionFor: (tag: OllamaTag) => string;
  headers: () => Record<string, string>;
  /** Resolved address, or null when this host is unavailable or unconfigured. */
  resolveBaseUrl: () => Promise<string | null>;
  /** Synchronous view of the same, for the non-async `languageModel`. */
  knownBaseUrl: () => string | undefined;
};

/**
 * Which host listed each model, recorded by `listModels`. Routing is taken from
 * where a model actually came from rather than inferred from its name: Ollama
 * names cloud models several ways (`glm-5.2:cloud`, `gpt-oss:120b-cloud`) and
 * none of that is ours to interpret. Reads follow a catalogue fetch, which is
 * what populates this.
 */
const modelHosts = new Map<string, "local" | "cloud">();

function trim(url: string): string {
  return url.replace(TRAILING_SLASHES, "");
}

async function probe(baseUrl: string, headers: Record<string, string>) {
  try {
    const response = await fetch(`${baseUrl}/api/version`, {
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

let discovered: string | null = null;
let discovering: Promise<string | null> | null = null;

async function discoverLocal(): Promise<string | null> {
  const override = process.env.OLLAMA_BASE_URL;

  if (override) {
    return trim(override);
  }

  if (discovered) {
    return discovered;
  }

  discovering ??= (async () => {
    // Probed together but chosen in candidate order, so a server on this host
    // still wins over the container one when both answer.
    const reachable = await Promise.all(
      CANDIDATE_BASE_URLS.map(async (url) => ({
        ok: await probe(url, {}),
        url,
      }))
    );
    const match = reachable.find((candidate) => candidate.ok)?.url ?? null;

    if (match) {
      discovered = match;
    } else {
      // Reset so a server started later is picked up on the next read.
      discovering = null;
    }

    return match;
  })();

  return await discovering;
}

async function hostFetch(
  host: OllamaHost,
  path: string,
  init: RequestInit,
  timeoutMs: number
) {
  const base = await host.resolveBaseUrl();

  if (!base) {
    return null;
  }

  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: { ...host.headers(), ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // No server is the normal case for anyone who has not installed Ollama, so
    // an unreachable host is never an error — it simply has no models.
    return null;
  }
}

/**
 * Ollama reports what a model can do directly, which beats guessing from the
 * name. `null` means it could not be asked.
 */
async function readCapabilityTags(
  host: OllamaHost,
  model: string
): Promise<Set<string> | null> {
  const response = await hostFetch(
    host,
    "/api/show",
    {
      body: JSON.stringify({ model }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    SHOW_TIMEOUT_MS
  );

  if (!response?.ok) {
    return null;
  }

  try {
    const json = (await response.json()) as { capabilities?: string[] };

    return new Set(json.capabilities ?? []);
  } catch {
    return null;
  }
}

function toCapabilities(tags: Set<string>): ModelCapabilities {
  return {
    reasoning: tags.has("thinking"),
    tools: tags.has("tools"),
    vision: tags.has("vision"),
  };
}

const LOCAL_HOST: OllamaHost = {
  descriptionFor: (tag) => {
    const parts = [tag.details?.parameter_size, tag.details?.quantization_level]
      .filter(Boolean)
      .join(", ");

    return parts ? `Local model (${parts})` : "Local model";
  },
  // A local server proxies Ollama Cloud models for a signed-in user, and still
  // requires the key to run them. Harmless for models it holds itself.
  headers: () => bearer(),
  knownBaseUrl: () => {
    const override = process.env.OLLAMA_BASE_URL;

    return override ? trim(override) : (discovered ?? undefined);
  },
  label: "Ollama",
  resolveBaseUrl: discoverLocal,
};

function bearer(): Record<string, string> {
  const key = process.env.OLLAMA_API_KEY;

  return key ? { Authorization: `Bearer ${key}` } : {};
}

function cloudBaseUrl(): string | undefined {
  return process.env.OLLAMA_API_KEY
    ? trim(process.env.OLLAMA_CLOUD_URL ?? OLLAMA_CLOUD_URL)
    : undefined;
}

const CLOUD_HOST: OllamaHost = {
  descriptionFor: () => "Hosted by Ollama Cloud",
  headers: bearer,
  knownBaseUrl: cloudBaseUrl,
  label: "Ollama Cloud",
  resolveBaseUrl: () => Promise.resolve(cloudBaseUrl() ?? null),
};

const CATALOGUE_TTL_MS = 60_000;

let catalogueCache: { at: number; models: CatalogueModel[] } | null = null;

type ListedModel = { model: CatalogueModel; remoteHost: string | undefined };

async function listFrom(host: OllamaHost): Promise<ListedModel[]> {
  const response = await hostFetch(host, "/api/tags", {}, LIST_TIMEOUT_MS);

  if (!response?.ok) {
    return [];
  }

  let tags: OllamaTag[] = [];

  try {
    const json = (await response.json()) as { models?: OllamaTag[] };
    tags = json.models ?? [];
  } catch {
    return [];
  }

  const described = await Promise.all(
    tags.map(async (tag) => ({
      capabilityTags: await readCapabilityTags(
        host,
        tag.model ?? tag.name ?? ""
      ),
      modelId: tag.model ?? tag.name ?? "",
      tag,
    }))
  );

  return (
    described
      // A pulled model is not necessarily a chat model: embedding models are
      // listed by /api/tags too and cannot answer a conversation.
      .filter(({ capabilityTags }) => capabilityTags?.has("completion"))
      // Names are used exactly as the server reports them.
      .map(({ capabilityTags, modelId, tag }) => ({
        model: {
          callable: true,
          capabilities: toCapabilities(capabilityTags ?? new Set()),
          description: host.descriptionFor(tag),
          id: `ollama/${modelId}`,
          modelId,
          name: modelId,
          owner: "ollama",
          providerId: "ollama" as const,
        },
        remoteHost: tag.remote_host,
      }))
  );
}

/**
 * One provider covering both a self-hosted Ollama and Ollama Cloud. Cloud-only
 * models are suffixed `-cloud`, matching how a signed-in local install names
 * the cloud models it proxies.
 */
export function createOllamaProvider(): ModelProvider {
  return {
    async availability(): Promise<ModelAvailability> {
      const [local, cloud] = await Promise.all([
        LOCAL_HOST.resolveBaseUrl(),
        CLOUD_HOST.resolveBaseUrl(),
      ]);

      return local || cloud ? "healthy" : "unknown";
    },

    id: "ollama",
    label: "Ollama",

    languageModel(modelId: string): LanguageModel {
      // Whichever host listed it. With a cold map, prefer a local server and
      // fall back to cloud, rather than reading anything into the name.
      const routeTo = modelHosts.get(modelId);
      const host =
        routeTo === "cloud" ||
        (routeTo === undefined && !LOCAL_HOST.knownBaseUrl())
          ? CLOUD_HOST
          : LOCAL_HOST;
      const base = host.knownBaseUrl();

      if (!base) {
        throw new Error(
          `No ${host.label} server is reachable for "${modelId}". Start Ollama, or set OLLAMA_API_KEY for cloud models.`
        );
      }

      // Ollama exposes an OpenAI-compatible surface at /v1, which keeps this on
      // a first-party AI SDK provider rather than a community package.
      return createOpenAICompatible({
        baseURL: `${base}/v1`,
        headers: host.headers(),
        name: "ollama",
      }).chatModel(modelId);
    },

    async listModels(): Promise<CatalogueModel[]> {
      const now = Date.now();

      if (catalogueCache && now - catalogueCache.at < CATALOGUE_TTL_MS) {
        return catalogueCache.models;
      }

      const [local, cloud] = await Promise.all([
        listFrom(LOCAL_HOST),
        listFrom(CLOUD_HOST),
      ]);

      const canReachCloud = Boolean(cloudBaseUrl());

      // Routing entries are added, never cleared wholesale: a host that failed
      // to answer this time must not un-route models it listed earlier.
      for (const { model, remoteHost } of local) {
        // /api/tags marks models the local server only proxies. Those need the
        // remote host's credentials, which we have when a key is configured —
        // so send them there rather than through a local server that would
        // reject them. Taken from the API, not from the model's name.
        const proxied = Boolean(remoteHost) && canReachCloud;

        modelHosts.set(model.modelId, proxied ? "cloud" : "local");
      }

      // A signed-in local install proxies cloud models already, so drop cloud
      // entries it reported under the same name.
      const seen = new Set(local.map(({ model }) => model.modelId));
      const cloudOnly = cloud.filter(({ model }) => !seen.has(model.modelId));

      for (const { model } of cloudOnly) {
        modelHosts.set(model.modelId, "cloud");
      }

      const models = [
        ...local.map(({ model }) => model),
        ...cloudOnly.map(({ model }) => model),
      ];
      catalogueCache = { at: now, models };

      return models;
    },
  };
}
