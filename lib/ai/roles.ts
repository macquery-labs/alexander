/**
 * The jobs this app asks a model to do. Everything that used to name a model
 * inline is a role here, so which model runs it is data rather than code.
 * Client-safe: the settings dialog imports this too.
 */
export const MODEL_ROLES = [
  "chat",
  "title",
  "artifact-text",
  "artifact-code",
  "artifact-sheet",
  "suggestions",
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

/** A concrete model reference for every role, resolved once per request. */
export type RoleModelIds = Record<ModelRole, string>;

/** What the user has chosen. Absent roles fall back, so every entry is optional. */
export type ModelSettings = Partial<Record<ModelRole, string>>;

/**
 * The `ModelSettings` column backing each role. One column per role, holding a
 * whole `provider/modelName` reference, so provider and model can never drift.
 */
export const MODEL_ROLE_COLUMNS = {
  "artifact-code": "artifactCode",
  "artifact-sheet": "artifactSheet",
  "artifact-text": "artifactText",
  chat: "chat",
  suggestions: "suggestions",
  title: "title",
} as const satisfies Record<ModelRole, string>;

/** Stored for a role that should track whatever the chat is using. */
export const INHERIT = "inherit";

export const MODEL_ROLE_INFO: Record<
  ModelRole,
  { label: string; description: string }
> = {
  "artifact-code": {
    description: "Writes and rewrites code artifacts.",
    label: "Code artifacts",
  },
  "artifact-sheet": {
    description: "Produces and edits spreadsheet artifacts.",
    label: "Spreadsheet artifacts",
  },
  "artifact-text": {
    description: "Writes and rewrites text documents.",
    label: "Text artifacts",
  },
  chat: {
    description:
      "Answers in the conversation, and stands in for any role set to follow it.",
    label: "Chat",
  },
  suggestions: {
    description: "Proposes edits to a document.",
    label: "Writing suggestions",
  },
  title: {
    description:
      "Names a conversation from its first message. A small, fast model is plenty.",
    label: "Chat titles",
  },
};

export function isModelRole(value: string): value is ModelRole {
  return (MODEL_ROLES as readonly string[]).includes(value);
}

export function artifactRole(kind: "text" | "code" | "sheet"): ModelRole {
  return `artifact-${kind}`;
}
