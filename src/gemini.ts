import {
  CompletionRequest,
  SYSTEM_PROMPT,
  STOP_SEQUENCES,
  buildUserPrompt,
  sanitize,
  CompletionHttpError,
} from "./prompt";

// Google Gemini via the Generative Language REST API. No SDK dependency — a
// single fetch keeps the bundle small. Node 18+ (and VS Code's host) has a
// global fetch. The free tier means users without Anthropic credit can still
// get completions.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export async function fetchGeminiCompletion(
  req: CompletionRequest
): Promise<string> {
  const url = `${BASE}/${encodeURIComponent(req.model)}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(req) }] }],
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: 0.2,
      stopSequences: STOP_SEQUENCES,
      // Gemini 2.5 models "think" by default, which eats the output-token
      // budget and truncates short completions. Disable it for fast FIM.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": req.apiKey,
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const j = (await resp.json()) as GeminiResponse;
      detail = j.error?.message || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new CompletionHttpError(resp.status, detail);
  }

  const data = (await resp.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    // Treated as "no suggestion" by the caller (empty string).
    return "";
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");

  return sanitize(text);
}
