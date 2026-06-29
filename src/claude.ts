import Anthropic from "@anthropic-ai/sdk";

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

const SYSTEM_PROMPT = [
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

/**
 * Markers tell the model precisely where the cursor sits. We instruct it to emit
 * only the insertion, so the fill-in-the-middle framing keeps it focused.
 */
function buildUserPrompt(req: CompletionRequest): string {
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

export async function fetchCompletion(
  req: CompletionRequest
): Promise<string> {
  const client = new Anthropic({ apiKey: req.apiKey });

  const response = await client.messages.create(
    {
      model: req.model,
      max_tokens: req.maxTokens,
      system: SYSTEM_PROMPT,
      // Stop as soon as the model tries to re-emit a region marker.
      stop_sequences: ["<|/BEFORE|>", "<|AFTER|>", "<|BEFORE|>"],
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    },
    { signal: req.signal }
  );

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return sanitize(text);
}

/** Strip stray markdown fences / leading newlines the model may add. */
function sanitize(raw: string): string {
  let text = raw;
  const fence = text.match(/^\s*```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (fence) {
    text = fence[1];
  }
  // Remove an accidental leading newline but preserve meaningful indentation.
  return text.replace(/^\n/, "");
}
