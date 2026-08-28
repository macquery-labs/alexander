import "server-only";

import { getModelSettingsByUserId } from "../db/queries";
import { DEFAULT_CHAT_MODEL, DEFAULT_TITLE_MODEL } from "./models";
import type { CatalogueModel } from "./providers";
import {
  INHERIT,
  MODEL_ROLES,
  type ModelRole,
  type ModelSettings,
  type RoleModelIds,
} from "./roles";

/**
 * Where a role points when the user has not chosen. Any role missing here
 * follows the chat model, which is what most of them should do.
 */
const DEFAULT_ROLE_MODELS: Partial<Record<ModelRole, string>> = {
  title: DEFAULT_TITLE_MODEL,
};

export async function getModelSettings(
  userId: string | undefined
): Promise<ModelSettings> {
  if (!userId) {
    return {};
  }

  try {
    return await getModelSettingsByUserId(userId);
  } catch {
    // Settings are a preference, not a prerequisite: a database hiccup should
    // fall back to defaults rather than fail the request.
    return {};
  }
}

/**
 * The model the conversation runs on: what was asked for if it exists, then the
 * configured default, then whatever the enabled providers actually offer. The
 * last step matters for an Ollama-only setup, where the gateway default cannot
 * be served.
 */
export function pickChatModelId(
  requested: string | undefined,
  catalogue: CatalogueModel[]
): string {
  const known = new Set(catalogue.map((model) => model.id));
  const usable = new Set(
    catalogue.filter((model) => model.callable).map((model) => model.id)
  );

  if (requested && known.has(requested)) {
    return requested;
  }

  if (usable.has(DEFAULT_CHAT_MODEL)) {
    return DEFAULT_CHAT_MODEL;
  }

  // Falling back to a listed-but-uncallable model would only fail later.
  const firstUsable = catalogue.find((model) => model.callable);

  return firstUsable?.id ?? catalogue[0]?.id ?? DEFAULT_CHAT_MODEL;
}

export function resolveRoleModelIds(
  settings: ModelSettings,
  chatModelId: string,
  catalogue: CatalogueModel[]
): RoleModelIds {
  const known = new Set(catalogue.map((model) => model.id));
  const usable = new Set(
    catalogue.filter((model) => model.callable).map((model) => model.id)
  );

  const forRole = (role: ModelRole): string => {
    const chosen = settings[role];

    // An explicit "follow the chat model" beats the role's own default.
    if (chosen === INHERIT) {
      return chatModelId;
    }

    if (chosen && known.has(chosen)) {
      return chosen;
    }

    const fallback = DEFAULT_ROLE_MODELS[role];

    // A default aimed at a provider without credentials must not strand the
    // role — an Ollama-only install still needs its chat titles generated.
    if (fallback && usable.has(fallback)) {
      return fallback;
    }

    return chatModelId;
  };

  return Object.fromEntries(
    MODEL_ROLES.map((role) => [
      role,
      role === "chat" ? chatModelId : forRole(role),
    ])
  ) as RoleModelIds;
}
