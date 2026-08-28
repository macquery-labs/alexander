import type { LanguageModel } from "ai";
import type { CatalogueModel, ModelProvider } from "./types";

/**
 * Deterministic stand-in used by the Playwright suite and by MOCK_AI=True, so
 * the app runs end to end with no gateway key and no local Ollama. It answers
 * to any model id, because the chat route always asks for a real one.
 */
export function createMockProvider(): ModelProvider {
  const { chatModel, titleModel } = require("../models.mock") as {
    chatModel: LanguageModel;
    titleModel: LanguageModel;
  };

  return {
    id: "mock",
    label: "Mock",

    languageModel(modelId: string): LanguageModel {
      return modelId === "title" ? titleModel : chatModel;
    },

    listModels(): Promise<CatalogueModel[]> {
      // Contributes nothing to the picker: it stands in for whichever provider
      // was asked for, rather than appearing as a choice of its own.
      return Promise.resolve([]);
    },
  };
}
