import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/config/env";
import type { LanguageModelV1 } from "ai";

let cachedModel: LanguageModelV1 | null = null;

export function getLlmModel(modelName?: string): LanguageModelV1 {
  const targetModel = modelName || env.LLM_MODEL || "gemini-3.5-flash-lite";

  if (cachedModel && !modelName) {
    return cachedModel;
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    env.GEMINI_API_KEY ||
    env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "LLM API Key missing. Please set GEMINI_API_KEY or LLM_API_KEY in your environment."
    );
  }

  const google = createGoogleGenerativeAI({
    apiKey,
  });

  console.log(`[LLM Client] Using model: "${targetModel}"`);
  const selectedModel = google(targetModel);

  if (!modelName) {
    cachedModel = selectedModel;
  }

  return selectedModel;
}

