import { loadJson, storageKeys } from "./storage";

export type HuggingFaceConfig = {
  apiKey: string;
  model: string;
};

/**
 * Models that support the HF OpenAI-compatible chat completions endpoint
 * AND respond with JSON reliably. Listed best-first.
 */
export const HF_RECOMMENDED_MODELS = [
  { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B (recommended — fast + JSON)" },
  { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B Instruct" },
  { id: "meta-llama/Llama-3.1-70B-Instruct", label: "Llama 3.1 70B Instruct" },
  { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B Instruct" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct" }
] as const;

export const HF_DEFAULT_MODEL = HF_RECOMMENDED_MODELS[0].id;

type ChatResp = {
  choices?: { message?: { content?: string } }[];
};

function buildUrl(model: string): string {
  return `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}/v1/chat/completions`;
}

function parseHfError(status: number, body: string): Error {
  if (status === 401 || status === 403) {
    return new Error("HF_AUTH: Hugging Face API key is invalid or expired. Update it in Settings.");
  }
  if (status === 422) {
    return new Error(
      "HF_UNSUPPORTED: This model does not support the chat/completions endpoint. " +
      "Choose a different model in Settings (e.g. Qwen/Qwen2.5-72B-Instruct)."
    );
  }
  if (status === 503 || status === 500) {
    return new Error(
      `HF_LOADING: Model is loading or temporarily unavailable (${status}). ` +
      "Wait 20–30 seconds and retry, or switch to another model in Settings."
    );
  }
  if (status === 429) {
    return new Error(
      "HF_RATE_LIMIT: Hugging Face rate limit reached. " +
      "Wait a minute and retry, or upgrade your HF account."
    );
  }
  return new Error(`HuggingFace ${status}: ${body.slice(0, 300)}`);
}

export async function hfChatJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const cfg = loadJson<HuggingFaceConfig>(storageKeys.huggingface, { apiKey: "", model: HF_DEFAULT_MODEL });
  const token = (cfg.apiKey ?? "").trim();
  if (!token) {
    throw new Error(
      "HF_NO_KEY: No Hugging Face API key configured. " +
      "Go to Settings → add your hf_... token from huggingface.co/settings/tokens"
    );
  }

  const model = (cfg.model ?? "").trim() || HF_DEFAULT_MODEL;
  const url = buildUrl(model);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      })
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      "HF_NETWORK: Cannot reach Hugging Face API. " +
      `Cause: ${msg}. ` +
      "Fix: check internet connection, disable ad-blockers or VPN, or switch network."
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw parseHfError(res.status, body);
  }

  const data = (await res.json()) as ChatResp;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("HuggingFace returned an empty response. Try a different model.");

  // Strip markdown code fences if model wraps JSON in ```json ... ```
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error(
      `HuggingFace returned invalid JSON. Raw response (first 300 chars):\n${cleaned.slice(0, 300)}`
    );
  }
}
