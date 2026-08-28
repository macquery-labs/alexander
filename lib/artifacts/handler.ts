/**
 * Document-handler contract and factory.
 *
 * Split out of `server.ts` so that `artifacts/<kind>/server.ts` can build a
 * handler without importing the registry that collects those same handlers.
 */
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import type { ArtifactKind } from "@/components/chat/artifact-types";
import { artifactRole, type RoleModelIds } from "../ai/roles";
import { saveDocument } from "../db/queries";
import type { Document } from "../db/schema";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

/**
 * What the tools pass in. The per-kind implementations still receive a single
 * resolved `modelId`; picking which one is this factory's job, because only it
 * knows the kind.
 */
export type CreateDocumentArgs = Omit<
  CreateDocumentCallbackProps,
  "modelId"
> & {
  roleModels: RoleModelIds;
};

export type UpdateDocumentArgs = Omit<
  UpdateDocumentCallbackProps,
  "modelId"
> & {
  roleModels: RoleModelIds;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentArgs) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentArgs) => Promise<void>;
};

/** Artifact kinds that have a server handler, hence a model role of their own. */
function modelIdForKind(kind: ArtifactKind, roleModels: RoleModelIds): string {
  return kind === "image" ? roleModels.chat : roleModels[artifactRole(kind)];
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentArgs) => {
      const draftContent = await config.onCreateDocument({
        dataStream: args.dataStream,
        id: args.id,
        modelId: modelIdForKind(config.kind, args.roleModels),
        session: args.session,
        title: args.title,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.id,
          kind: config.kind,
          title: args.title,
          userId: args.session.user.id,
        });
      }
    },
    onUpdateDocument: async (args: UpdateDocumentArgs) => {
      const draftContent = await config.onUpdateDocument({
        dataStream: args.dataStream,
        description: args.description,
        document: args.document,
        modelId: modelIdForKind(config.kind, args.roleModels),
        session: args.session,
      });

      if (args.session?.user?.id) {
        await saveDocument({
          content: draftContent,
          id: args.document.id,
          kind: config.kind,
          title: args.document.title,
          userId: args.session.user.id,
        });
      }
    },
  };
}
