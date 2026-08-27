import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { DocumentHandler } from "./handler";

export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
