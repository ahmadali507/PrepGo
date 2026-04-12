import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import type { z } from "zod";

/**
 * Single-model override: if set, only that model is used (no automatic fallback).
 * Otherwise we try {@link GEMINI_MODEL_FALLBACK_CHAIN} in order.
 */
export function getGeminiModelId(): string {
  const fromEnv = process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return GEMINI_MODEL_FALLBACK_CHAIN[0];
}

/** Prefer lighter / alternate endpoints when `gemini-2.5-flash` returns 503 “high demand”. */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export function getGeminiModelFallbackChain(): string[] {
  const single = process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim();
  if (single) return [single];
  return [...GEMINI_MODEL_FALLBACK_CHAIN];
}

export function createGeminiModel(options?: { structuredOutputs?: boolean }) {
  return google(getGeminiModelId(), {
    structuredOutputs: options?.structuredOutputs ?? false,
  });
}

function stringifyErrorDeep(error: unknown): string {
  if (error == null) return "";
  if (error instanceof Error) {
    const any = error as Error & {
      statusCode?: number;
      cause?: unknown;
      lastError?: unknown;
      reason?: string;
    };
    let out = `${error.name}: ${error.message}`;
    if (any.statusCode != null) out += ` status=${any.statusCode}`;
    if (any.reason) out += ` reason=${any.reason}`;
    if (any.lastError) out += ` | nested: ${stringifyErrorDeep(any.lastError)}`;
    if (any.cause) out += ` | cause: ${stringifyErrorDeep(any.cause)}`;
    return out;
  }
  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/** True when trying another model in the chain may help (overload / quota / transient). */
export function shouldTryNextGeminiModel(error: unknown): boolean {
  const s = stringifyErrorDeep(error).toLowerCase();
  if (s.includes("invalid api key") || s.includes(" api key")) return false;
  if (s.includes("permission") && s.includes("denied")) return false;
  if (s.includes("not found") && s.includes("model")) return false;
  return (
    s.includes("high demand") ||
    s.includes("unavailable") ||
    s.includes("overloaded") ||
    s.includes("503") ||
    s.includes("429") ||
    s.includes("quota") ||
    s.includes("resource_exhausted") ||
    s.includes("rate limit") ||
    s.includes("try again later")
  );
}

export async function generateObjectWithGeminiFallback<OBJECT>(options: {
  schema: z.ZodType<OBJECT>;
  prompt: string;
  system?: string;
}) {
  const chain = getGeminiModelFallbackChain();
  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const modelId = chain[i];
    try {
      const result = await generateObject({
        model: google(modelId, { structuredOutputs: false }),
        schema: options.schema,
        prompt: options.prompt,
        system: options.system,
        maxRetries: 0,
      });
      if (i > 0) {
        console.info(`[PrepWise] Structured generation succeeded with fallback model: ${modelId}`);
      }
      return result;
    } catch (e) {
      lastError = e;
      const canTry = i < chain.length - 1 && shouldTryNextGeminiModel(e);
      if (!canTry) throw e;
      console.warn(
        `[PrepWise] Gemini model "${modelId}" failed (${stringifyErrorDeep(e).slice(0, 200)}…); trying next model…`
      );
    }
  }
  throw lastError;
}

export async function generateTextWithGeminiFallback(options: { prompt: string }) {
  const chain = getGeminiModelFallbackChain();
  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const modelId = chain[i];
    try {
      const result = await generateText({
        model: google(modelId),
        prompt: options.prompt,
        maxRetries: 0,
      });
      if (i > 0) {
        console.info(`[PrepWise] Text generation succeeded with fallback model: ${modelId}`);
      }
      return result;
    } catch (e) {
      lastError = e;
      const canTry = i < chain.length - 1 && shouldTryNextGeminiModel(e);
      if (!canTry) throw e;
      console.warn(
        `[PrepWise] Gemini model "${modelId}" failed; trying next model…`
      );
    }
  }
  throw lastError;
}

/** User-safe message when Google returns quota / rate limit / overload errors */
export function formatGoogleAiError(error: unknown, fallback: string): string {
  const blob = stringifyErrorDeep(error).toLowerCase();
  if (
    blob.includes("high demand") ||
    blob.includes("unavailable") ||
    blob.includes("503") ||
    blob.includes("overloaded")
  ) {
    return (
      "Google’s Gemini service was temporarily busy for the model we tried. " +
      "The app automatically falls back across gemini-2.5-flash-lite → 2.5-flash → 2.0-flash → 1.5-flash; " +
      "if this still fails, wait a minute and try again, or set GOOGLE_GENERATIVE_AI_MODEL in .env to a specific model. " +
      "See https://ai.google.dev/gemini-api/docs/rate-limits"
    );
  }
  if (
    blob.includes("quota") ||
    blob.includes("resource_exhausted") ||
    blob.includes("429") ||
    blob.includes("rate limit") ||
    blob.includes("billing")
  ) {
    return (
      "Google Gemini quota or rate limit was hit for this model. " +
      "Wait a few minutes and try again, enable billing in Google AI Studio for higher limits, " +
      "or set GOOGLE_GENERATIVE_AI_MODEL to another model with available quota " +
      "(e.g. gemini-2.5-flash-lite, gemini-2.0-flash, or gemini-1.5-flash — each counts separately on the free tier). " +
      "Details: https://ai.google.dev/gemini-api/docs/rate-limits"
    );
  }
  return fallback;
}
