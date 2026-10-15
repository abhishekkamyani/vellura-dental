import { ApiError, type GenerateContentParameters, type GenerateContentResponse, type GoogleGenAI } from "@google/genai";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isOverloaded(error: unknown) {
  return error instanceof ApiError && RETRYABLE.has(error.status);
}

/**
 * Calls Gemini, riding out temporary overloads ("model is experiencing high demand"):
 * each model is tried with a short backoff, then the fallback model takes over.
 */
export async function generateWithRetry(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, "model">,
  models: string[],
  attemptsPerModel = 2,
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < attemptsPerModel; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (error) {
        lastError = error;
        if (!isOverloaded(error)) throw error;
        if (attempt < attemptsPerModel - 1) await sleep(600 * 2 ** attempt + Math.random() * 300);
      }
    }
    console.warn(`Gemini model "${model}" is overloaded; trying the next option.`);
  }
  throw lastError;
}
