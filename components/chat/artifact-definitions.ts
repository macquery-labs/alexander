import { codeArtifact } from "@/artifacts/code/client";
import { imageArtifact } from "@/artifacts/image/client";
import { sheetArtifact } from "@/artifacts/sheet/client";
import { textArtifact } from "@/artifacts/text/client";
import type { ArtifactKind } from "./artifact-types";

/**
 * The `satisfies` clause fails the build if an artifact declares a kind that
 * `ArtifactKind` does not list.
 */
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
] satisfies readonly { kind: ArtifactKind }[];
