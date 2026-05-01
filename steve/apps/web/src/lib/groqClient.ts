import { loadJson, storageKeys } from "./storage";
import type { GroqKeys } from "./types";
import { hfChatJson } from "./hfClient";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_GROQ_MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined)?.trim() || "llama-3.3-70b-versatile";

type ChatResp = {
  choices?: { message?: { content?: string } }[];
};

// ─── Groq error parsing ───────────────────────────────────────────────────────

function parseGroqRetryAfter(body: string): string | null {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    const m = (j?.error?.message ?? "").match(/try again in ([^\s.]+)/i);
    return m ? m[1]! : null;
  } catch { return null; }
}

function isTokenDailyLimit(body: string): boolean {
  return body.includes("tokens per day") || body.includes("TPD");
}

// ─── Groq fetch ───────────────────────────────────────────────────────────────

async function groqCompletion(apiKey: string, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(GROQ_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error(`GROQ_NETWORK: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (res.ok) return (await res.json()) as ChatResp;

  const raw = await res.text();
  if (res.status === 429) {
    const wait = parseGroqRetryAfter(raw);
    if (isTokenDailyLimit(raw)) throw new Error(`GROQ_DAILY_LIMIT${wait ? `:${wait}` : ""}`);
    throw new Error("GROQ_RATE_LIMIT_TPM");
  }
  if (res.status === 401 || res.status === 403) throw new Error("GROQ_AUTH");
  throw new Error(`Groq ${res.status}: ${raw.slice(0, 300)}`);
}

function rotateKeys(): string[] {
  const groqKeys = loadJson<GroqKeys>(storageKeys.groqKeys, { keys: [] });
  return (groqKeys.keys ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 5);
}

export async function groqChatJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const keys = rotateKeys();
  if (!keys.length) throw new Error("GROQ_NO_KEY: No Groq API key configured.");

  let lastErr: Error | null = null;
  let dailyLimitWait: string | null = null;

  for (const apiKey of keys) {
    try {
      const data = await groqCompletion(apiKey, {
        model: DEFAULT_GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.35,
        response_format: { type: "json_object" }
      });
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Empty response from Groq.");
      return JSON.parse(text) as unknown;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const msg = lastErr.message;
      if (msg.startsWith("GROQ_DAILY_LIMIT")) {
        const wait = msg.split(":")[1] ?? null;
        if (wait) dailyLimitWait = wait;
        continue; // try next key
      }
      if (msg === "GROQ_RATE_LIMIT_TPM") continue;
      throw lastErr;
    }
  }

  if (dailyLimitWait) {
    throw new Error(
      `All Groq keys hit the daily 100k token limit. Retry in ~${dailyLimitWait}. ` +
      `Add another key in Settings or use Hugging Face.`
    );
  }
  throw lastErr ?? new Error("All Groq keys failed.");
}

// ─── Primary router — HuggingFace first, Groq as fallback ────────────────────

export type AiProvider = "groq" | "huggingface";

function isKeyMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("HF_NO_KEY") || msg.startsWith("GROQ_NO_KEY");
}

function isNetworkBlock(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("HF_NETWORK") || msg.startsWith("GROQ_NETWORK");
}

function friendlyMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("HF_AUTH")) return "Hugging Face API key is invalid or expired — update in Settings.";
  if (msg.startsWith("HF_NO_KEY")) return "No Hugging Face API key — add it in Settings.";
  if (msg.startsWith("HF_NETWORK")) return "Hugging Face API unreachable (network/VPN/firewall).";
  if (msg.startsWith("HF_UNSUPPORTED")) return "Model doesn't support JSON chat completions — switch model in Settings.";
  if (msg.startsWith("HF_LOADING")) return "Model is loading on HF servers — wait 30 s and retry.";
  if (msg.startsWith("HF_RATE_LIMIT")) return "Hugging Face rate limit — wait a minute and retry.";
  if (msg.startsWith("GROQ_DAILY_LIMIT")) return "Groq daily token limit reached — retry later or add another key.";
  if (msg.startsWith("GROQ_AUTH")) return "Groq API key invalid — update in Settings.";
  if (msg.startsWith("GROQ_NO_KEY")) return "No Groq API key — add one in Settings.";
  return msg.slice(0, 300);
}

// ─── Plain-text chat (no JSON mode) ──────────────────────────────────────────

type PlainChatResp = { choices?: { message?: { content?: string } }[] };

async function groqPlainText(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.6,
      max_tokens: 1024
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as PlainChatResp;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response.");
  return text;
}

async function hfPlainText(system: string, user: string): Promise<string> {
  const cfg = loadJson<{ apiKey: string; model: string }>(storageKeys.huggingface, { apiKey: "", model: "Qwen/Qwen2.5-72B-Instruct" });
  const token = (cfg.apiKey ?? "").trim();
  if (!token) throw new Error("HF_NO_KEY");
  const model = (cfg.model ?? "").trim() || "Qwen/Qwen2.5-72B-Instruct";
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}/v1/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.6,
        max_tokens: 1024
      })
    });
  } catch (e) { throw new Error(`HF_NETWORK: ${e instanceof Error ? e.message : String(e)}`); }
  if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
  const data = (await res.json()) as PlainChatResp;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty HF response.");
  return text;
}

/**
 * Plain-text chat for conversational AI (AI Advisor).
 * Does NOT use response_format: json_object — returns a plain string.
 */
export async function chatText(system: string, user: string): Promise<string> {
  // Try HF first
  try { return await hfPlainText(system, user); } catch (hfErr) {
    const hfMsg = hfErr instanceof Error ? hfErr.message : String(hfErr);
    if (!hfMsg.startsWith("HF_NO_KEY") && !hfMsg.startsWith("HF_NETWORK")) {
      throw new Error(hfMsg);
    }
  }
  // Groq fallback
  const keys = rotateKeys();
  if (!keys.length) throw new Error("No API key configured. Add a Groq or HF key in Settings.");
  let lastErr: Error | null = null;
  for (const key of keys) {
    try { return await groqPlainText(key, system, user); }
    catch (e) { lastErr = e instanceof Error ? e : new Error(String(e)); }
  }
  throw lastErr ?? new Error("All providers failed.");
}

/**
 * STEVE uses Hugging Face as the primary AI provider.
 * Falls back to Groq ONLY when HF key is missing or network-blocked.
 */
export async function chatJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  // Always try HF first
  try {
    return await hfChatJson(systemPrompt, userPrompt);
  } catch (hfErr) {
    const hfMsg = hfErr instanceof Error ? hfErr.message : String(hfErr);

    // If HF is network-blocked or key missing, try Groq as automatic fallback
    if (isNetworkBlock(hfErr) || isKeyMissing(hfErr)) {
      const groqKeys = rotateKeys();
      if (groqKeys.length > 0) {
        try {
          return await groqChatJson(systemPrompt, userPrompt);
        } catch (groqErr) {
          const groqMsg = friendlyMessage(groqErr);
          throw new Error(
            `Hugging Face: ${friendlyMessage(hfErr)}\n` +
            `Groq (fallback): ${groqMsg}\n\n` +
            `Fix: add a valid Hugging Face key in Settings, or check your network.`
          );
        }
      }
    }

    // All other HF errors — throw with a clear message
    throw new Error(friendlyMessage(hfErr));
  }
}
