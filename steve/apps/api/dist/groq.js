import { z } from "zod";
const GroqChatRequestSchema = z.object({
    model: z.string().min(1),
    messages: z
        .array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
    }))
        .min(1),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional()
});
export class GroqError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
function isRetryableStatus(status) {
    return status === 401 || status === 403 || status === 429;
}
export async function groqChatWithRotation(opts) {
    const keys = opts.keys.map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0)
        throw new GroqError("No Groq API keys provided.");
    const parsed = GroqChatRequestSchema.safeParse(opts.request);
    if (!parsed.success) {
        throw new GroqError("Invalid Groq request payload.", 400, parsed.error.flatten());
    }
    let lastErr;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
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
            const data = (await res.json());
            const content = data?.choices?.[0]?.message?.content ?? "";
            return { content, usedKeyIndex: i };
        }
        catch (err) {
            if (err instanceof GroqError) {
                lastErr = err;
                if (isRetryableStatus(err.status))
                    continue;
                throw err;
            }
            lastErr = err;
            continue;
        }
    }
    throw new GroqError("All Groq keys failed. Add more keys or wait for rate limits to reset.", 429, lastErr);
}
