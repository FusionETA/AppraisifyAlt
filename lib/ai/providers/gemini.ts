import "server-only"

/**
 * Default Gemini model. 2.5 Flash is the current GA flash model — fast,
 * free-tier friendly, and supported on the v1beta API. Override with
 * GEMINI_MODEL env (e.g. gemini-2.5-pro).
 */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

export type GeminiChatMessage = { role: "user" | "model"; text: string }

/**
 * Generic multi-turn text chat against Gemini's `generateContent` endpoint —
 * used by AI-assist-style chat features. No `responseMimeType` is forced
 * since replies here are free-form prose, sometimes containing embedded
 * tagged JSON blocks the caller parses itself.
 */
export async function chatWithGemini(options: {
  systemInstruction: string
  messages: GeminiChatMessage[]
  temperature?: number
  maxOutputTokens?: number
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
  const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: options.systemInstruction }] },
      contents: options.messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxOutputTokens ?? 2000,
        // 2.5 models default "thinking" on and can silently eat the whole
        // token budget, returning an empty completion. We only want text.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(
      `Gemini chat request failed (${response.status}): ${errorBody.slice(0, 300)}`,
    )
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }

  const reply = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!reply) {
    throw new Error("Gemini chat returned an empty completion.")
  }

  return reply
}
