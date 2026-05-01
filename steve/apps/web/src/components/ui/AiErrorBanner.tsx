import { AlertTriangle, Clock, Cpu, Key, Wifi } from "lucide-react";
import { Link } from "react-router-dom";

type Props = { message: string; onDismiss?: () => void };

function parseKind(msg: string): "daily_limit" | "auth" | "network" | "loading" | "unsupported" | "generic" {
  if (msg.includes("DAILY_LIMIT") || msg.includes("100k token")) return "daily_limit";
  if (msg.includes("HF_AUTH") || msg.includes("GROQ_AUTH") || msg.includes("invalid or expired") || msg.includes("revoked")) return "auth";
  if (msg.includes("HF_NETWORK") || msg.includes("GROQ_NETWORK") || msg.includes("unreachable") || msg.includes("Failed to fetch")) return "network";
  if (msg.includes("HF_LOADING") || msg.includes("loading")) return "loading";
  if (msg.includes("HF_UNSUPPORTED") || msg.includes("does not support")) return "unsupported";
  return "generic";
}

function extractWait(msg: string): string | null {
  const m = msg.match(/Retry in ~?([^\s.]+)/i) ?? msg.match(/try again in ([^\s.]+)/i);
  return m ? m[1]! : null;
}

export function AiErrorBanner({ message, onDismiss }: Props) {
  const kind = parseKind(message);
  const wait = kind === "daily_limit" ? extractWait(message) : null;

  const configs: Record<string, {
    icon: React.ComponentType<{ className?: string }>;
    bg: string; iconColor: string; title: string; detail: string; fix: string | null;
  }> = {
    loading: {
      icon: Cpu,
      bg: "border-blue-200 bg-blue-50",
      iconColor: "text-blue-600",
      title: "Model is loading",
      detail: "Hugging Face is warming up the model on their servers. This usually takes 20–60 seconds.",
      fix: "Wait a moment and click Generate again."
    },
    unsupported: {
      icon: AlertTriangle,
      bg: "border-amber-300 bg-amber-50",
      iconColor: "text-amber-600",
      title: "Model doesn't support JSON chat",
      detail: "The selected model doesn't have the HF chat/completions endpoint enabled.",
      fix: "Go to Settings and switch to 'Qwen 2.5 72B' or 'Llama 3.3 70B'."
    },
    daily_limit: {
      icon: Clock,
      bg: "border-amber-300 bg-amber-50",
      iconColor: "text-amber-600",
      title: "Groq daily token limit reached",
      detail: `Free tier allows 100,000 tokens/day. ${wait ? `Resets in ~${wait}.` : "Resets at midnight UTC."}`,
      fix: "Add a second Groq account key in Settings to continue generating now."
    },
    auth: {
      icon: Key,
      bg: "border-red-300 bg-red-50",
      iconColor: "text-red-600",
      title: "Invalid Groq API key",
      detail: "Your key was rejected (invalid or revoked).",
      fix: "Update your key in Settings → Groq API keys."
    },
    network: {
      icon: Wifi,
      bg: "border-orange-300 bg-orange-50",
      iconColor: "text-orange-600",
      title: "AI provider blocked on this network",
      detail: "The request couldn't reach the API (campus Wi-Fi, VPN, or ad-blockers).",
      fix: "Try a mobile hotspot or disable browser extensions, then retry."
    },
    generic: {
      icon: AlertTriangle,
      bg: "border-red-200 bg-red-50",
      iconColor: "text-red-600",
      title: "Generation failed",
      detail: message.split("\n")[0] ?? message,
      fix: null
    }
  };

  const c = configs[kind];
  const Icon = c.icon;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${c.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${c.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900">{c.title}</div>
          <p className="mt-1 text-sm text-slate-700">{c.detail}</p>
          {c.fix && <p className="mt-1 text-sm font-medium text-slate-800">{c.fix}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0056D2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A5BD8]"
            >
              <Key className="h-3.5 w-3.5" />
              Open Settings → API Keys
            </Link>
            {kind === "daily_limit" && (
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Get a second Groq key →
              </a>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
