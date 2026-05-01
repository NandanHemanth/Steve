import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Headphones, Square, Eye, EyeOff, Loader2 } from "lucide-react";
import { LessonContent } from "../components/tutor/LessonContent";
import { Button } from "../components/ui/Button";
import { getCourse, setLessonCompletion, upsertCourse } from "../lib/tutor/repo";
import { flattenLessons } from "../lib/tutor/schedulePlans";
import { coerceSlideDeckFromPayload, ensureNonEmptyDeck } from "../lib/tutor/slideDeck";
import { normalizeLessonPayload, regenerateModulePack } from "../lib/tutor/tutorAi";

function asObj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function speakText(text: string) {
  if (typeof window === "undefined") return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  utter.volume = 1;
  synth.speak(utter);
  return true;
}

function stopSpeaking() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

function buildModuleDetailedSummary(args: { moduleTitle: string; moduleSummary?: string; lessonTitles: string[] }) {
  const base = (args.moduleSummary ?? "").trim();
  const lines: string[] = [];
  if (base) lines.push(base);
  lines.push(
    "In this module, focus on vocabulary, clear definitions, and the ability to explain trade-offs using examples from your material."
  );
  if (args.lessonTitles.length) {
    const top = args.lessonTitles.slice(0, 7).map((t) => `• ${t}`);
    lines.push("What you’ll cover:");
    lines.push(...top);
  }
  lines.push("Study targets:");
  lines.push("• You can define key terms precisely (no hand-waving).");
  lines.push("• You can justify a choice or recommendation with constraints and evidence.");
  lines.push("• You can answer short checks quickly and identify common pitfalls.");
  return lines.join("\n");
}

function ModuleOverview(props: {
  moduleTitle: string;
  moduleSummary?: string;
  sourceText?: string;
  lessons: { title: string; kind: string; minutesEstimate: number; payload: Record<string, unknown> }[];
  onRegenerate?: () => void;
  regenBusy?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [openTeach, setOpenTeach] = useState(true);

  const slidesLesson = useMemo(() => props.lessons.find((l) => l.kind === "slides"), [props.lessons]);
  const infographicLesson = useMemo(() => props.lessons.find((l) => l.kind === "infographic"), [props.lessons]);
  const modulePptLesson = useMemo(
    () => props.lessons.find((l) => l.kind === "slides" && l.title.toLowerCase().includes("module ppt deck")),
    [props.lessons]
  );
  const moduleInfLesson = useMemo(
    () => props.lessons.find((l) => l.kind === "infographic" && l.title.toLowerCase().includes("module visual digest")),
    [props.lessons]
  );
  const moduleNotesLesson = useMemo(
    () => props.lessons.find((l) => l.kind === "reading" && l.title.toLowerCase().includes("module study notes")),
    [props.lessons]
  );
  const moduleAudioLesson = useMemo(
    () => props.lessons.find((l) => l.kind === "audio_script" && l.title.toLowerCase().includes("module audio summary")),
    [props.lessons]
  );
  const moduleQuizLesson = useMemo(
    () => props.lessons.find((l) => l.kind === "quiz" && l.title.toLowerCase().includes("module practice quiz")),
    [props.lessons]
  );

  const notesSections = useMemo(() => {
    const secs = Array.isArray((moduleNotesLesson?.payload as any)?.sections) ? ((moduleNotesLesson!.payload as any).sections as any[]) : [];
    return secs
      .map((s) => {
        const o = asObj(s) ?? {};
        const heading = typeof o.heading === "string" ? o.heading : "Section";
        const body = Array.isArray(o.body) ? (o.body as unknown[]).map(String).filter(Boolean) : [];
        return { heading, body };
      })
      .filter((s) => s.body.length);
  }, [moduleNotesLesson]);

  const audioLines = useMemo(() => {
    const au = (moduleAudioLesson?.payload as any)?.audio_script ?? (moduleAudioLesson?.payload as any);
    const lines = Array.isArray(au?.lines) ? (au.lines as unknown[]).map(String).filter(Boolean) : [];
    return lines.slice(0, 26);
  }, [moduleAudioLesson]);

  const quizQuestions = useMemo(() => {
    const qz = (moduleQuizLesson?.payload as any)?.quiz ?? (moduleQuizLesson?.payload as any);
    const qs = Array.isArray(qz?.questions) ? (qz.questions as any[]) : [];
    return qs
      .map((q) => {
        const o = asObj(q) ?? {};
        const prompt = typeof o.prompt === "string" ? o.prompt : "";
        const options = Array.isArray(o.options) ? (o.options as unknown[]).map(String).filter(Boolean) : [];
        const correctIndex = typeof o.correctIndex === "number" ? o.correctIndex : 0;
        return { prompt, options, correctIndex };
      })
      .filter((q) => q.prompt && q.options.length >= 2)
      .slice(0, 6);
  }, [moduleQuizLesson]);

  function tokenize(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "from", "that", "this", "into", "your"].includes(w));
  }

  function bestSnippets(source: string, query: string, limit = 12) {
    const terms = new Set(tokenize(query));
    if (!source.trim() || terms.size === 0) return [];
    const sentences = source
      .replace(/\n+/g, "\n")
      .split(/(?<=[.!?])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 40 && x.length < 260);
    const scored = sentences
      .map((s) => {
        const t = tokenize(s);
        let score = 0;
        for (const w of t) if (terms.has(w)) score++;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.s);
  }

  const slides = useMemo(() => {
    const ppt = modulePptLesson ?? slidesLesson;
    if (ppt) {
      const deck = ensureNonEmptyDeck(coerceSlideDeckFromPayload(ppt.payload), ppt.title);
      return deck.slice(0, 5);
    }
    const src = props.sourceText ?? "";
    const query = [props.moduleTitle, ...props.lessons.map((l) => l.title).slice(0, 6)].join(" ");
    const snippets = src.length > 800 ? bestSnippets(src, query, 18) : [];
    if (snippets.length) {
      const take = snippets.slice(0, 18);
      const mkSlide = (title: string, bullets: string[]) => ({ title, bullets: bullets.slice(0, 6) });
      const s1 = mkSlide(`${props.moduleTitle}: purpose & scope`, take.slice(0, 4));
      const s2 = mkSlide("Key concepts to remember", take.slice(4, 8));
      const s3 = mkSlide("Process / practices", take.slice(8, 12));
      const s4 = mkSlide("Risks, constraints, pitfalls", take.slice(12, 16));
      const s5 = mkSlide("What to do next", take.slice(16, 18).concat(["Turn two bullets into your own example from the PDF."]));
      return [s1, s2, s3, s4, s5].map((s) => ({ title: s.title, bullets: s.bullets.filter(Boolean) })).filter((s) => s.bullets.length >= 2).slice(0, 5);
    }
    return [];
  }, [props.sourceText, props.moduleTitle, props.lessons, slidesLesson, modulePptLesson]);

  const diagram = useMemo(() => {
    const ppt = modulePptLesson ?? slidesLesson;
    const d = ppt ? (ppt.payload as any)?.diagram : null;
    const o = asObj(d);
    const nodes = Array.isArray(o?.nodes) ? (o!.nodes as unknown[]) : [];
    const edges = Array.isArray(o?.edges) ? (o!.edges as unknown[]) : [];
    const parsedNodes = nodes
      .map((n) => {
        const nn = asObj(n) ?? {};
        const id = typeof nn.id === "string" ? nn.id : "";
        const label = typeof nn.label === "string" ? nn.label : "";
        const x = typeof nn.x === "number" ? nn.x : 0;
        const y = typeof nn.y === "number" ? nn.y : 0;
        if (!id || !label) return null;
        return { id, label, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
      })
      .filter((x): x is { id: string; label: string; x: number; y: number } => x !== null);
    const parsedEdges: { from: string; to: string; label?: string }[] = edges
      .map((e) => {
        const ee = asObj(e) ?? {};
        const from = typeof ee.from === "string" ? ee.from : "";
        const to = typeof ee.to === "string" ? ee.to : "";
        const label = typeof ee.label === "string" ? ee.label : undefined;
        if (!from || !to) return null;
        return { from, to, ...(label ? { label } : {}) };
      })
      .filter((x) => x !== null) as { from: string; to: string; label?: string }[];
    if (!parsedNodes.length) return null;
    return { title: typeof o?.title === "string" ? (o!.title as string) : "Module diagram", nodes: parsedNodes, edges: parsedEdges };
  }, [modulePptLesson, slidesLesson]);

  const highlights = useMemo(() => {
    const infL = moduleInfLesson ?? infographicLesson;
    if (infL) {
      const inf = asObj((infL.payload as { infographic?: unknown }).infographic) ?? asObj(infL.payload) ?? {};
      const raw = (inf as { highlights?: unknown }).highlights;
      const arr = Array.isArray(raw) ? raw : [];
      const parsed = arr
        .map((h) => {
          const o = asObj(h) ?? {};
          const label = typeof o.label === "string" ? o.label : typeof o.title === "string" ? o.title : "";
          const value = typeof o.value === "string" ? o.value : typeof o.text === "string" ? o.text : "";
          if (!label && !value) return null;
          return { label: label || "Highlight", value: value || "" };
        })
        .filter((x): x is { label: string; value: string } => x !== null);
      if (parsed.length) return parsed.slice(0, 8);
    }
    const src = props.sourceText ?? "";
    const query = [props.moduleTitle, ...props.lessons.map((l) => l.title).slice(0, 6)].join(" ");
    const snippets = src.length > 800 ? bestSnippets(src, query, 10) : [];
    if (snippets.length) {
      return [
        { label: "Key idea", value: snippets[0] ?? "" },
        { label: "Why it matters", value: snippets[1] ?? snippets[0] ?? "" },
        { label: "How it works", value: snippets[2] ?? "" },
        { label: "Constraints", value: snippets[3] ?? "" },
        { label: "Pitfall", value: snippets[4] ?? "" },
        { label: "Action", value: snippets[5] ?? "Write one example pulled directly from your PDF." }
      ].filter((x) => x.value.trim().length > 0);
    }
    return [];
  }, [props.sourceText, props.moduleTitle, props.lessons, infographicLesson, moduleInfLesson]);

  const summaryText = useMemo(
    () => {
      const base = buildModuleDetailedSummary({
        moduleTitle: props.moduleTitle,
        moduleSummary: props.moduleSummary,
        lessonTitles: props.lessons.map((l) => l.title)
      });
      const src = props.sourceText ?? "";
      const query = [props.moduleTitle, ...props.lessons.map((l) => l.title).slice(0, 6)].join(" ");
      const snippets = src.length > 800 ? bestSnippets(src, query, 8) : [];
      if (!snippets.length) return base;
      return `${base}\n\nFrom your uploaded PDF:\n${snippets.map((s) => `• ${s}`).join("\n")}`;
    },
    [props.moduleTitle, props.moduleSummary, props.lessons]
  );

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const onEnd = () => setSpeaking(false);
    synth.addEventListener?.("end", onEnd as unknown as EventListener);
    return () => {
      stopSpeaking();
      synth.removeEventListener?.("end", onEnd as unknown as EventListener);
    };
  }, []);

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{props.moduleTitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-slate-200 bg-white"
            disabled={!props.onRegenerate || props.regenBusy}
            onClick={() => props.onRegenerate?.()}
          >
            Regenerate pack
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="border border-slate-200 bg-white"
            onClick={() => {
              if (speaking) {
                stopSpeaking();
                setSpeaking(false);
                return;
              }
              const ok = speakText(summaryText);
              setSpeaking(ok);
            }}
          >
            {speaking ? <Square className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
            {speaking ? "Stop" : "Listen"}
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setOpenTeach((v) => !v)}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module pack</div>
            <div className="mt-1 text-base font-semibold text-slate-900">Everything you need in one place</div>
          </div>
          <div className="text-sm font-semibold text-[#0056D2]">{openTeach ? "Hide" : "Show"}</div>
        </button>

        {openTeach ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reading notes</div>
              {notesSections.length ? (
                <div className="mt-2 space-y-3">
                  {notesSections.slice(0, 4).map((s, i) => (
                    <div key={i}>
                      <div className="text-sm font-semibold text-slate-900">{s.heading}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {s.body.slice(0, 5).map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">No module notes found yet. Click “Regenerate pack”.</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audio + practice</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-slate-200 bg-white"
                  disabled={!audioLines.length}
                  onClick={() => {
                    if (!window.speechSynthesis) return;
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(audioLines.join(". "));
                    u.rate = 0.98;
                    window.speechSynthesis.speak(u);
                  }}
                >
                  Play module audio
                </Button>
              </div>
              {quizQuestions.length ? (
                <div className="mt-4 space-y-3">
                  {quizQuestions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-sm font-semibold text-slate-900">{q.prompt}</div>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                        {q.options.slice(0, 4).map((o, oi) => (
                          <li key={oi}>{o}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-600">No module quiz found yet. Click “Regenerate pack”.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slides</div>
          {slides.length ? (
            <div className="mt-2 space-y-3">
              {slides.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {s.bullets.slice(0, 5).map((b, bi) => (
                      <li key={bi}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">No slides lesson in this module yet.</div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graphics (infographic highlights)</div>
          {diagram ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white p-3">
              <div className="text-sm font-semibold text-slate-900">{diagram.title}</div>
              <svg className="mt-3 h-[220px] w-full" viewBox="0 0 1000 420" role="img" aria-label="Module diagram">
                <defs>
                  <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 z" fill="#94A3B8" />
                  </marker>
                </defs>
                {diagram.edges.map((e, i) => {
                  const a = diagram.nodes.find((n) => n.id === e.from);
                  const b = diagram.nodes.find((n) => n.id === e.to);
                  if (!a || !b) return null;
                  const x1 = a.x * 1000;
                  const y1 = a.y * 420;
                  const x2 = b.x * 1000;
                  const y2 = b.y * 420;
                  return (
                    <g key={i}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94A3B8" strokeWidth="2" markerEnd="url(#arrow)" />
                      {e.label ? (
                        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize="12" textAnchor="middle" fill="#334155">
                          {e.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {diagram.nodes.map((n) => (
                  <g key={n.id} transform={`translate(${n.x * 1000}, ${n.y * 420})`}>
                    <rect x={-120} y={-22} width={240} height={44} rx={12} fill="#F2F7FF" stroke="#2563EB" strokeWidth="2" />
                    <text x="0" y="5" fontSize="14" textAnchor="middle" fill="#0F172A">
                      {n.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : null}
          {highlights.length ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {highlights.map((h, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{h.label}</div>
                  {h.value ? <div className="mt-1 text-sm text-slate-700">{h.value}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-600">No infographic lesson in this module yet.</div>
          )}

          <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detailed summary</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{summaryText}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rev, setRev] = useState(0);
  const [regenBusy, setRegenBusy] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const lessonId = searchParams.get("lesson") ?? undefined;

  const course = useMemo(() => {
    const c = courseId ? getCourse(courseId) : undefined;
    if (!c) return undefined;
    // Normalize legacy/empty payloads for display so older courses still show content.
    return {
      ...c,
      modules: c.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({
          ...l,
          payload: normalizeLessonPayload(l.kind as any, (l.payload ?? {}) as any, l.title, l.minutesEstimate)
        }))
      }))
    };
  }, [courseId, rev]);
  const bump = () => setRev((v) => v + 1);

  if (!courseId || !course) {
    return (
      <div className="text-sm text-slate-600">
        Course not found.{" "}
        <Link className="text-[#0056D2] underline" to="/app/dashboard">
          Dashboard
        </Link>
      </div>
    );
  }

  const flat = flattenLessons(course.modules);
  const active = flat.find((l) => l.id === lessonId) ?? flat.find((l) => !l.completedAtISO) ?? flat[0];
  const idx = active ? flat.findIndex((l) => l.id === active.id) : -1;
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const activeModule = active ? course.modules.find((m) => m.id === active.moduleId) : undefined;

  function goLesson(l: { id: string }) {
    setSearchParams({ lesson: l.id });
  }

  return (
    <div>
      <div className="text-sm text-slate-600">
        <Link className="text-[#0056D2] underline" to="/app/dashboard">
          Dashboard
        </Link>
        {" · "}
        <Link className="text-[#0056D2] underline" to={`/app/courses/${course.id}`}>
          {course.title}
        </Link>
        {" · Learn"}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside className="max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Course outline</div>
          {course.modules.map((m) => (
            <div key={m.id} className="mt-2">
              <div className="rounded-xl bg-slate-50 px-2 py-2 text-xs font-bold text-slate-800">{m.title}</div>
              <ul className="mt-1 space-y-0.5">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => goLesson(l)}
                      className={clsx(
                        "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm transition",
                        l.id === active?.id ? "border-l-2 border-[#0056D2] bg-[#F2F7FF]" : "hover:bg-slate-50"
                      )}
                    >
                      {l.completedAtISO ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                      )}
                      <span>
                        <span className="font-medium text-slate-900">{l.title}</span>
                        <span className="mt-0.5 block text-[11px] capitalize text-slate-500">
                          {l.kind.replaceAll("_", " ")} · {l.minutesEstimate} min
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <main className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {active ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{active.kind.replaceAll("_", " ")}</div>
                  <h1 className="mt-1 text-xl font-semibold text-slate-900">{active.title}</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-slate-200 bg-white"
                    disabled={!prev}
                    onClick={() => prev && goLesson(prev)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-slate-200 bg-white"
                    disabled={!next}
                    onClick={() => next && goLesson(next)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* AI TRACKING SECTION */}
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${isTracking ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="text-sm font-medium text-slate-700">
                    {isTracking ? 'AI Learning Analytics Active' : 'Enable AI-Powered Accessibility Tracking'}
                  </span>
                </div>
                <Button
                  type="button"
                  disabled={isProcessing}
                  onClick={async () => {
                    if (isTracking) {
                      setIsProcessing(true);
                      try {
                        const res = await fetch("http://127.0.0.1:8788/api/track/stop", { method: "POST" });
                        const data = await res.json();
                        if (data.status === "success") {
                          const link = document.createElement("a");
                          link.href = `http://127.0.0.1:8788/api/track/report/${data.pdf_path}`;
                          link.setAttribute("download", data.pdf_path);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else {
                          alert("Failed to generate report: " + (data.message || "Unknown error"));
                        }
                      } catch (err) {
                        console.error(err);
                        alert("Network error: Could not connect to AI server.");
                      } finally {
                        setIsTracking(false);
                        setIsProcessing(false);
                      }
                    } else {
                      setIsTracking(true);
                      await fetch("http://127.0.0.1:8788/api/track/start", { method: "POST" });
                    }
                  }}
                  className={clsx(
                    "flex items-center gap-2 px-6",
                    isTracking ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-[#0056D2] text-white hover:bg-[#00419e]"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isTracking ? (
                    <>
                      <EyeOff className="h-4 w-4" /> Stop Tracking
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" /> AI Track Session
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-6">
                {activeModule &&
                course.modules.length &&
                activeModule.id === course.modules[0]!.id &&
                activeModule.lessons.length &&
                active.id === activeModule.lessons[0]!.id ? (
                  <ModuleOverview
                    moduleTitle={activeModule.title}
                    moduleSummary={activeModule.summary}
                    sourceText={course.sourceText ?? course.sourceSnippet}
                    regenBusy={regenBusy}
                    onRegenerate={async () => {
                      try {
                        setRegenBusy(true);
                        const latest = getCourse(course.id);
                        if (!latest) return;
                        const updated = await regenerateModulePack(latest, activeModule.id);
                        upsertCourse(updated);
                        bump();
                      } finally {
                        setRegenBusy(false);
                      }
                    }}
                    lessons={activeModule.lessons.map((l) => ({
                      title: l.title,
                      kind: l.kind,
                      minutesEstimate: l.minutesEstimate,
                      payload: l.payload
                    }))}
                  />
                ) : null}
                <LessonContent lesson={active} />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                {active.completedAtISO ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-slate-200"
                    onClick={() => {
                      setLessonCompletion(course.id, active.id, false);
                      bump();
                    }}
                  >
                    Mark incomplete
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setLessonCompletion(course.id, active.id, true);
                      bump();
                      if (next) goLesson(next);
                    }}
                  >
                    Mark complete {next ? "& next" : ""}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  disabled={isProcessing}
                  onClick={async () => {
                    if (isTracking) {
                      setIsProcessing(true);
                      try {
                        const res = await fetch("http://127.0.0.1:8788/api/track/stop", { method: "POST" });
                        const data = await res.json();
                        if (data.status === "success") {
                          const link = document.createElement("a");
                          link.href = `http://127.0.0.1:8788/api/track/report/${data.pdf_path}`;
                          link.setAttribute("download", data.pdf_path);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } else {
                          alert("Failed to generate report: " + (data.message || "Unknown error"));
                        }
                      } catch (err) {
                        console.error(err);
                        alert("Network error: Could not connect to AI server.");
                      } finally {
                        setIsTracking(false);
                        setIsProcessing(false);
                      }
                    } else {
                      setIsTracking(true);
                      await fetch("http://127.0.0.1:8788/api/track/start", { method: "POST" });
                    }
                  }}
                  className={clsx(
                    "ml-auto flex items-center gap-2",
                    isTracking ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isTracking ? (
                    <>
                      <EyeOff className="h-4 w-4" /> Stop Tracking
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" /> AI Track Session
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">No lessons in this course yet.</p>
          )}
        </main>
      </div>
    </div>
  );
}
