import Anthropic from "@anthropic-ai/sdk";
import {
  CompletionRequest,
  SYSTEM_PROMPT,
  STOP_SEQUENCES,
  buildUserPrompt,
  sanitize,
} from "./prompt";

export async function fetchClaudeCompletion(
  req: CompletionRequest
): Promise<string> {
  const client = new Anthropic({ apiKey: req.apiKey });

  const response = await client.messages.create(
    {
      model: req.model,
      max_tokens: req.maxTokens,
      system: SYSTEM_PROMPT,
      stop_sequences: STOP_SEQUENCES,
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
