"use client";

import useSWR from "swr";
import { chatModels } from "@/lib/ai/models";
import type { CatalogueModel, ModelProviderId } from "@/lib/ai/providers/types";
import type { ModelSettings } from "@/lib/ai/roles";

export type ProviderSummary = { id: ModelProviderId; label: string };

export type ModelGroup = {
  key: string;
  heading: string;
  /** False for gateway models outside the curated line-up on the public demo. */
  selectable: boolean;
  models: CatalogueModel[];
};

/** Why a model cannot be picked, or null when it can. */
export function unavailableReason(
  model: CatalogueModel,
  group: ModelGroup
): string | null {
  if (!group.selectable) {
    return "This model is not available in the demo.";
  }

  if (!model.callable) {
    return model.unavailableReason ?? "This model is not configured.";
  }

  return null;
}

type ModelsResponse = {
  models: CatalogueModel[];
  providers: ProviderSummary[];
  settings: ModelSettings;
};

const GATEWAY_LABEL = "Vercel AI Gateway";

/**
 * Shown before /api/models answers, so the picker is never briefly empty. Only
 * the gateway line-up is known client-side; discovered providers arrive with
 * the response.
 */
const FALLBACK_MODELS: CatalogueModel[] = chatModels.map((model) => ({
  callable: true,
  capabilities: { reasoning: false, tools: false, vision: false },
  description: model.description,
  id: `gateway/${model.id}`,
  modelId: model.id,
  name: model.name,
  owner: model.provider,
  providerId: "gateway",
}));

const FALLBACK_PROVIDERS: ProviderSummary[] = [
  { id: "gateway", label: GATEWAY_LABEL },
];

const CURATED_IDS = new Set(FALLBACK_MODELS.map((model) => model.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function useModelCatalogue() {
  const { data, mutate } = useSWR<ModelsResponse>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    // no-store rather than the default: the response carries this user's own
    // settings, and a response cached under an older shape must not be reused.
    (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json()),
    { dedupingInterval: 30_000, revalidateOnFocus: false }
  );

  // Nothing below assumes the payload is well formed. A response left over from
  // an earlier deployment still parses as JSON but has none of these fields.
  const models = Array.isArray(data?.models) ? data.models : null;
  const providers = Array.isArray(data?.providers) ? data.providers : null;

  return {
    catalogue: models ?? FALLBACK_MODELS,
    isLoaded: models !== null,
    mutate,
    providers: providers ?? FALLBACK_PROVIDERS,
    settings: isRecord(data?.settings) ? (data.settings as ModelSettings) : {},
  };
}

export function groupCatalogue(
  catalogue: CatalogueModel[],
  providers: ProviderSummary[]
): ModelGroup[] {
  const labels = new Map(providers.map((p) => [p.id, p.label] as const));
  const selectable = new Map<string, CatalogueModel[]>();
  const locked = new Map<string, CatalogueModel[]>();

  for (const model of catalogue) {
    const isLocked =
      model.providerId === "gateway" && !CURATED_IDS.has(model.id);
    const target = isLocked ? locked : selectable;
    const key = isLocked ? model.owner : model.providerId;
    const bucket = target.get(key) ?? [];

    bucket.push(model);
    target.set(key, bucket);
  }

  const ordered: ModelGroup[] = [];

  for (const provider of providers) {
    const models = selectable.get(provider.id);

    if (models?.length) {
      ordered.push({
        heading: provider.label,
        key: provider.id,
        models,
        selectable: true,
      });
    }
  }

  // Any provider the response did not describe, so nothing is silently dropped.
  for (const [key, models] of selectable) {
    if (!labels.has(key as ModelProviderId)) {
      ordered.push({ heading: key, key, models, selectable: true });
    }
  }

  for (const key of [...locked.keys()].sort((a, b) => a.localeCompare(b))) {
    ordered.push({
      heading: key,
      key: `locked:${key}`,
      models: locked.get(key) ?? [],
      selectable: false,
    });
  }

  return ordered;
}
