import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/config/env";
import type { LanguageModelV1 } from "ai";

let cachedModel: LanguageModelV1 | null = null;

// Cache up to 200 thought signatures from Gemini function calls
const signatureCache = new Map<string, string>();

/**
 * Custom fetch wrapper that preserves Gemini thought signatures across multi-step tool calls.
 * Gemini 2.5/3.5 models require thought_signature on functionCall parts in conversation history,
 * but @ai-sdk/google v1.1.20 drops them when sending tool execution results back to the model.
 * See: https://aistudio.google.com/docs/thought-signatures
 */
async function geminiThoughtSignatureFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const options = init ? { ...init } : {};

  if (options.body && typeof options.body === "string") {
    try {
      const body = JSON.parse(options.body);
      let modified = false;

      if (Array.isArray(body.contents)) {
        for (const content of body.contents) {
          if (content.role === "model" && Array.isArray(content.parts)) {
            for (const part of content.parts) {
              if (part.functionCall && !part.thoughtSignature && !part.thought_signature) {
                const call = part.functionCall;
                const keyById = call.id ? String(call.id) : null;
                const keyByArgs = `${call.name}:${JSON.stringify(call.args || {})}`;
                const keyByName = call.name;

                const sig =
                  (keyById && signatureCache.get(keyById)) ||
                  signatureCache.get(keyByArgs) ||
                  signatureCache.get(keyByName);

                if (sig) {
                  part.thoughtSignature = sig;
                  part.thought_signature = sig;
                  modified = true;
                }
              }
            }
          }
        }
      }

      if (modified) {
        options.body = JSON.stringify(body);
      }
    } catch {
      // If parsing fails, proceed with original body
    }
  }

  const res = await fetch(input, options);

  // Intercept response to extract and cache thought signatures
  try {
    const clone = res.clone();
    const data = await clone.json();

    if (data && Array.isArray(data.candidates)) {
      for (const cand of data.candidates) {
        if (cand.content && Array.isArray(cand.content.parts)) {
          for (const part of cand.content.parts) {
            const sig = part.thoughtSignature || part.thought_signature;
            if (part.functionCall && sig) {
              const call = part.functionCall;
              if (call.id) signatureCache.set(String(call.id), sig);
              signatureCache.set(`${call.name}:${JSON.stringify(call.args || {})}`, sig);
              signatureCache.set(call.name, sig);

              // Evict oldest if exceeding 200 entries
              if (signatureCache.size > 200) {
                const firstKey = signatureCache.keys().next().value;
                if (firstKey) signatureCache.delete(firstKey);
              }
            }
          }
        }
      }
    }
  } catch {
    // If response is not JSON or cloning fails, ignore
  }

  return res;
}

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
    fetch: geminiThoughtSignatureFetch,
  });

  console.log(`[LLM Client] Using model: "${targetModel}"`);
  const selectedModel = google(targetModel);

  if (!modelName) {
    cachedModel = selectedModel;
  }

  return selectedModel;
}
