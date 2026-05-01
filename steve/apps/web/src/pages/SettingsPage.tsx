import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Key } from "lucide-react";
import { Button } from "../components/ui/Button";
import { loadJson, saveJson, storageKeys } from "../lib/storage";
import type { GroqKeys } from "../lib/types";
import type { HuggingFaceConfig } from "../lib/hfClient";
import { HF_RECOMMENDED_MODELS, HF_DEFAULT_MODEL } from "../lib/hfClient";

const groqEmpty: GroqKeys = { keys: ["", "", "", "", ""] };
const hfEmpty: HuggingFaceConfig = { apiKey: "", model: HF_DEFAULT_MODEL };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25 font-mono";

export function SettingsPage() {
  const existing = useMemo(() => loadJson<GroqKeys>(storageKeys.groqKeys, groqEmpty), []);
  const hfExisting = useMemo(() => loadJson<HuggingFaceConfig>(storageKeys.huggingface, hfEmpty), []);

  const [keys, setKeys] = useState<GroqKeys>(existing);
  const [hf, setHf] = useState<HuggingFaceConfig>(hfExisting);
  const [saved, setSaved] = useState(false);

  const hfConfigured = hf.apiKey.trim().startsWith("hf_");
  const groqCount = keys.keys.filter((k) => k.trim().length > 0).length;

  const save = () => {
    // Always persist HF as primary provider
    saveJson(storageKeys.huggingface, { apiKey: hf.apiKey.trim(), model: hf.model.trim() || HF_DEFAULT_MODEL });
    saveJson(storageKeys.groqKeys, { keys: keys.keys.map((k) => k.trim()).filter(Boolean).slice(0, 5) });
    saveJson(storageKeys.aiProvider, { provider: "huggingface" });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Settings</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">API Keys</h1>
          <p className="mt-1 text-sm text-slate-600">
            STEVE uses <span className="font-semibold text-slate-800">Hugging Face</span> as the primary AI provider.
            Groq is kept as an automatic fallback.
          </p>
        </div>
        <Button onClick={save} className="shrink-0">Save settings</Button>
      </motion.div>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Saved — Hugging Face is now the primary AI provider.
        </motion.div>
      )}

      {/* ── Hugging Face (PRIMARY) ─────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="mt-6 overflow-hidden rounded-2xl border-2 border-[#0056D2]/30 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#F2F7FF] px-5 py-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-[#0056D2]" />
            <span className="text-sm font-bold text-[#0056D2]">Hugging Face</span>
            <span className="rounded-full bg-[#0056D2] px-2 py-0.5 text-[10px] font-bold text-white">PRIMARY</span>
          </div>
          {hfConfigured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> Key set
            </span>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="text-sm text-slate-600">
              Get a free token at{" "}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0056D2] underline"
              >
                huggingface.co/settings/tokens
              </a>{" "}
              → create a token with <span className="font-semibold">Read</span> permission.
            </p>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-700">API token</span>
            <input
              value={hf.apiKey}
              onChange={(e) => setHf({ ...hf, apiKey: e.target.value })}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
              className={inputCls}
              autoComplete="off"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Model</span>
            <select
              value={hf.model || HF_DEFAULT_MODEL}
              onChange={(e) => setHf({ ...hf, model: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25"
            >
              {HF_RECOMMENDED_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              <option value={hf.model && !HF_RECOMMENDED_MODELS.some((m) => m.id === hf.model) ? hf.model : ""} disabled>
                {hf.model && !HF_RECOMMENDED_MODELS.some((m) => m.id === hf.model) ? `Custom: ${hf.model}` : "── Custom ──"}
              </option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Or enter custom model ID</span>
            <input
              value={hf.model}
              onChange={(e) => setHf({ ...hf, model: e.target.value })}
              placeholder="org/model-name"
              className={inputCls}
            />
            <span className="text-[11px] text-slate-500">
              Must support the HF Inference API chat/completions endpoint. Only some models do.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-600">
              <span className="font-semibold">Free tier:</span> limited requests/hour depending on model.
              Larger models may need a Pro subscription.
            </div>
            <a
              href="https://huggingface.co/pricing"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline"
            >
              HF Pricing <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </motion.section>

      {/* ── Groq (FALLBACK) ───────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">Groq</span>
            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-500">FALLBACK</span>
          </div>
          {groqCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> {groqCount} key{groqCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            Used automatically if Hugging Face is unavailable. Get free keys at{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#0056D2] underline"
            >
              console.groq.com/keys
            </a>
            . Free tier: 100k tokens/day. Add multiple keys for rotation.
          </p>

          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <label key={i} className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Key {i + 1}</span>
                <input
                  value={keys.keys[i] ?? ""}
                  onChange={(e) => {
                    const next = [...keys.keys];
                    next[i] = e.target.value;
                    setKeys({ ...keys, keys: next });
                  }}
                  placeholder="gsk_..."
                  className={inputCls}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Keys are stored in your browser's localStorage — never sent to any server other than Groq/HF.
          </div>
        </div>
      </motion.section>
    </div>
  );
}
