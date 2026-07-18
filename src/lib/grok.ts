import OpenAI from "openai";

/**
 * Prefer cheaper extract model for invoice splitting (cost control).
 * Override with XAI_EXTRACT_MODEL / XAI_MODEL in .env.local.
 * Check console.x.ai for current model IDs.
 */
const DEFAULT_MODEL = process.env.XAI_MODEL || "grok-4.5";
const EXTRACT_MODEL =
  process.env.XAI_EXTRACT_MODEL ||
  process.env.XAI_MODEL ||
  "grok-4-1-fast-non-reasoning";

export function getGrokClient() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing XAI_API_KEY. Add it to .env.local (see .env.example)."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });
}

export function getModel() {
  return DEFAULT_MODEL;
}

export function getExtractModel() {
  return EXTRACT_MODEL;
}

/** Chat-completions helper (OpenAI-compatible xAI endpoint). Token-aware. */
export async function grokChat(params: {
  system: string;
  user: string;
  imageBase64?: string;
  imageMime?: string;
  temperature?: number;
  /** Cap completion tokens (default 900 — enough for structured JSON) */
  maxTokens?: number;
  /** Override model; use getExtractModel() for invoice extraction */
  model?: string;
}): Promise<string> {
  const client = getGrokClient();
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: params.user },
  ];

  if (params.imageBase64 && params.imageMime) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${params.imageMime};base64,${params.imageBase64}`,
      },
    });
  }

  const response = await client.chat.completions.create({
    model: params.model || getModel(),
    temperature: params.temperature ?? 0.2,
    max_tokens: params.maxTokens ?? 900,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: userContent },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Grok");
  }
  return text;
}
