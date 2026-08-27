import { Schema } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";

/**
 * Lives in its own module so that `config.ts` and `functions.tsx` can both
 * depend on it without importing each other.
 */
export const documentSchema = new Schema({
  marks: schema.spec.marks,
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
});
