import { z } from "zod";

const GroqChatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
      })
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional()
});

export type GroqChatRequest = z.infer<typeof GroqChatRequestSchema>;

export class GroqError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
  }
}

function isRetryableStatus(status?: number) {
  return status === 401 || status === 403 || status === 429;
}

export async function groqChatWithRotation(opts: {
  keys: string[];
  request: GroqChatRequest;
}) {
  const keys = opts.keys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new GroqError("No Groq API keys provided.");

  const parsed = GroqChatRequestSchema.safeParse(opts.request);
  if (!parsed.success) {
    throw new GroqError("Invalid Groq request payload.", 400, parsed.error.flatten());
  }

  let lastErr: unknown;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsed.data)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isRetryableStatus(res.status)) {
          lastErr = new GroqError("Groq key failed, trying next key.", res.status, text);
          continue;
        }
        throw new GroqError("Groq request failed.", res.status, text);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data?.choices?.[0]?.message?.content ?? "";
      return { content, usedKeyIndex: i };
    } catch (err) {
      if (err instanceof GroqError) {
        lastErr = err;
        if (isRetryableStatus(err.status)) continue;
        throw err;
      }
      lastErr = err;
      continue;
    }
  }

  throw new GroqError(
    "All Groq keys failed. Add more keys or wait for rate limits to reset.",
    429,
    lastErr
  );
}

