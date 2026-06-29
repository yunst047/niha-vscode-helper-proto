// Shared completion prompt + request shape, used by every provider backend
// (Anthropic, Gemini) so they produce identical fill-in-the-middle behaviour.

export type Provider = "anthropic" | "gemini";

export interface CompletionRequest {
  apiKey: string;
  model: string;
  maxTokens: number;
  languageId: string;
  /** Code before the cursor. */
  prefix: string;
  /** Code after the cursor. */
  suffix: string;
  fileName: string;
  signal: AbortSignal;
}

export const SYSTEM_PROMPT = [
  "You are a code completion engine, like GitHub Copilot.",
  "You are given the code BEFORE the cursor and the code AFTER the cursor.",
  "Return ONLY the text that should be inserted at the cursor to continue the code naturally.",
  "Rules:",
  "- Output raw code only. No explanations, no markdown fences, no commentary.",
  "- Do not repeat code that already appears in the prefix or the suffix.",
  "- Continue from exactly where the prefix ends; match the existing indentation and style.",
  "- Prefer a small, useful completion (finish the current line or a short block).",
  "- If no sensible completion exists, return an empty string.",
].join("\n");

export const STOP_SEQUENCES = ["<|/BEFORE|>", "<|AFTER|>", "<|BEFORE|>"];

export function buildUserPrompt(req: CompletionRequest): string {
  return [
    `Language: ${req.languageId}`,
    `File: ${req.fileName}`,
    "",
    "Code before the cursor (insert your completion at the very end of this block):",
    "<|BEFORE|>",
    req.prefix,
    "<|/BEFORE|>",
    "",
    "Code after the cursor:",
    "<|AFTER|>",
    req.suffix,
    "<|/AFTER|>",
    "",
    "Insertion text only:",
  ].join("\n");
}

/** Strip stray markdown fences / a leading newline the model may add. */
export function sanitize(raw: string): string {
  let text = raw;
  const fence = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (fence) {
    text = fence[1];
  }
  return text.replace(/^\n/, "");
}

/** Error carrying an HTTP status so the provider UI can react (401/429/...). */
export class CompletionHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "CompletionHttpError";
  }
}
