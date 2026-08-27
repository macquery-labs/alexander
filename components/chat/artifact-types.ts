/**
 * Leaf module: no imports, so anything in the artifact graph can depend on it.
 *
 * `ArtifactKind` is written out rather than derived from `artifactDefinitions`
 * because the definitions pull in the artifact clients, which in turn need
 * these types — deriving it would put the whole graph in a cycle. The
 * `satisfies` clause in artifact-definitions.ts keeps the two in sync.
 */
export type ArtifactKind = "text" | "code" | "image" | "sheet";

export type UIArtifact = {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
};
