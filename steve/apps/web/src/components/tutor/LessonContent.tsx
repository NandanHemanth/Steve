import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { LessonKind, TutorLesson } from "../../lib/tutor/types";
import { coerceSlideDeckFromPayload, ensureNonEmptyDeck } from "../../lib/tutor/slideDeck";
import { exportSlidesToPptx } from "../../lib/exports/pptxExport";
import { exportSlidesToPdf } from "../../lib/exports/pdfExport";
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  Layers,
  Map,
  Puzzle,
  Table2,
  Type,
  BarChart4
} from "lucide-react";

type Props = { lesson: TutorLesson };

function asStrings(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((z) => (typeof z === "string" ? z : ""));
}

export function LessonContent({ lesson }: Props) {
  const k = lesson.kind as LessonKind;
  switch (k) {
    case "slides":
      return <SlidesView lesson={lesson} />;
    case "flashcards":
      return <FlashcardsView payload={lesson.payload} />;
    case "mindmap":
      return <MindmapView payload={lesson.payload} />;
    case "reading":
      return <ReadingView payload={lesson.payload} />;
    case "infographic":
      return <InfographicView payload={lesson.payload} />;
    case "quiz":
      return <QuizView payload={lesson.payload} />;
    case "audio_script":
      return <AudioScript payload={lesson.payload} />;
    case "data_table":
      return <DataTable payload={lesson.payload} />;
    case "game":
      return <MatchGame payload={lesson.payload} />;
    default:
      return <Fallback kind={lesson.kind} />;
  }
}

function Fallback({ kind }: { kind: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      Unknown or legacy lesson format ({kind}). Mark complete when finished.
    </div>
  );
}

function SlidesView({ lesson }: { lesson: TutorLesson }) {
  const slides = useMemo(
    () =>
      ensureNonEmptyDeck(coerceSlideDeckFromPayload(lesson.payload as Record<string, unknown>), lesson.title),
    [lesson.payload, lesson.title]
  );
  const diagram = (lesson.payload as any)?.diagram;
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
  }, [lesson.id]);

  useEffect(() => {
    setI((idx) => Math.min(idx, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  const slide = slides[Math.min(Math.max(i, 0), Math.max(slides.length - 1, 0))];
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Layers className="h-4 w-4 text-[#0056D2]" aria-hidden /> Slides · {slides.length ? `${Math.min(i + 1, slides.length)}/${slides.length}` : "—"}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => exportSlidesToPptx({ title: lesson.title, slides, diagram })}
        >
          Download PPTX
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => exportSlidesToPdf({ title: lesson.title, slides, diagram })}
        >
          Download PDF
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-[#fafbfc] p-6 shadow-inner">
        <div className="text-lg font-semibold text-slate-900">{slide?.title ?? lesson.title}</div>
        <ul className="mt-4 space-y-2">
          {(slide?.bullets ?? []).map((line, idx) => (
            <li key={idx} className="flex gap-2 text-sm leading-relaxed text-slate-800">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0056D2]" />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
          onClick={() => setI((v) => Math.min(Math.max(slides.length - 1, 0), v + 1))}
          disabled={slides.length === 0 || i >= slides.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FlashcardsView({ payload }: { payload: Record<string, unknown> }) {
  const cards = Array.isArray(payload.flashcards)
    ? (payload.flashcards as { front?: string; back?: string }[])
    : [];
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];
  if (!card) {
    return <p className="text-sm text-slate-600">No flashcards in this lesson.</p>;
  }
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Type className="h-4 w-4 text-[#0056D2]" aria-hidden /> Flashcards · {idx + 1}/{cards.length}
      </div>
      <button
        type="button"
        className={clsx(
          "relative flex min-h-[180px] w-full flex-col rounded-2xl border-2 px-6 py-6 text-left shadow-sm transition",
          flipped ? "border-indigo-200 bg-indigo-50/60" : "border-[#0056D2]/25 bg-[#F2F7FF]"
        )}
        onClick={() => setFlipped((v) => !v)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{flipped ? "Back" : "Front"}</span>
        <span className="mt-4 text-base font-semibold leading-relaxed text-slate-900">
          {flipped ? card.back ?? "—" : card.front ?? "—"}
        </span>
        <span className="mt-auto pt-4 text-xs text-slate-500">Tap to flip</span>
      </button>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
          onClick={() => {
            setIdx((v) => Math.max(0, v - 1));
            setFlipped(false);
          }}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm"
          onClick={() => {
            setIdx((v) => Math.min(cards.length - 1, v + 1));
            setFlipped(false);
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function MindmapView({ payload }: { payload: Record<string, unknown> }) {
  const m = payload.mindmap as { topic?: string; branches?: { label?: string; children?: unknown[] }[] } | undefined;
  const topic = m?.topic ?? "Topic map";
  const branches = Array.isArray(m?.branches) ? m!.branches! : [];
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Map className="h-4 w-4 text-[#0056D2]" aria-hidden /> Mind map
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="rounded-xl bg-[#0056D2] px-4 py-3 text-center text-sm font-semibold text-white">{topic}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {branches.length ? (
            branches.map((b, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{b.label ?? "Branch"}</div>
                {(asStrings(b.children) || []).slice(0, 8).map((c, j) => (
                  <div key={j} className="mt-1 text-xs text-slate-700">
                    · {c}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No branches parsed — skim and mark complete.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadingView({ payload }: { payload: Record<string, unknown> }) {
  const secs = Array.isArray(payload.sections)
    ? (payload.sections as { heading?: string; body?: unknown[] }[])
    : [];
  return (
    <div className="prose prose-slate max-w-none">
      {secs.map((s, i) => (
        <section key={i} className="mb-6">
          <h3 className="text-base font-semibold text-slate-900">{s.heading ?? "Section"}</h3>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-800">
            {Array.isArray(s.body) ? s.body.map((p, j) => <p key={j}>{String(p)}</p>) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function InfographicView({ payload }: { payload: Record<string, unknown> }) {
  const inf = payload.infographic as {
    title?: string;
    highlights?: { label?: string; value?: string }[];
    note?: string;
  };
  const title = inf?.title ?? "Insights";
  const highlights =
    inf?.highlights ?? ([{ label: "Takeaway", value: "—" }] as { label: string; value: string }[]);
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <BarChart4 className="h-4 w-4 text-[#0056D2]" aria-hidden /> Infographic digest
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#0056D2]/20 bg-gradient-to-br from-[#F2F7FF] via-white to-indigo-50/40 p-6">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{h.label ?? "—"}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{h.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {inf?.note ? <p className="mt-6 text-sm text-slate-700">{inf.note}</p> : null}
      </div>
    </div>
  );
}

function QuizView({ payload }: { payload: Record<string, unknown> }) {
  const qz = payload.quiz as {
    questions?: { prompt?: string; options?: string[]; correctIndex?: number }[];
  };
  const questions = Array.isArray(qz?.questions) ? qz!.questions! : [];
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [show, setShow] = useState(false);
  let correct = 0;
  questions.forEach((q, qi) => {
    if ((picked[qi] ?? -1) === (q.correctIndex ?? -2)) correct++;
  });
  return (
    <div>
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-2xl border border-slate-200 bg-[#fafbfc] p-4">
            <div className="text-sm font-semibold text-slate-900">{q.prompt ?? "Question"}</div>
            <div className="mt-3 grid gap-2">
              {(q.options ?? ["A", "B", "C", "D"]).map((opt, oi) => (
                <label
                  key={oi}
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                    picked[qi] === oi ? "border-[#0056D2] bg-[#F2F7FF]" : "border-slate-200 bg-white"
                  )}
                >
                  <input
                    type="radio"
                    className="shrink-0"
                    name={`q-${qi}`}
                    checked={picked[qi] === oi}
                    onChange={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {show && (
              <p className="mt-2 text-xs font-medium text-slate-700">
                Answer: {(q.options ?? [])[q.correctIndex ?? 0] ?? "—"}
              </p>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="mt-4 rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white" onClick={() => setShow(true)}>
        Check answers
      </button>
      {show && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          Score: {questions.length ? Math.round((correct / questions.length) * 100) : 0}% ({correct}/{questions.length})
        </p>
      )}
    </div>
  );
}

function AudioScript({ payload }: { payload: Record<string, unknown> }) {
  const au = payload.audio_script as { lines?: string[] } | undefined;
  const lines = Array.isArray(au?.lines)
    ? au!.lines!.map(String)
    : ["Relax your shoulders.", "Now read each line calmly — this reinforces active recall.", "You've got this."];
  const utter = () => {
    if (!window.speechSynthesis) return;
    const text = lines.join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => utter()}
        className="inline-flex items-center gap-2 rounded-xl border border-[#0056D2]/35 bg-[#F2F7FF] px-4 py-2 text-sm font-semibold text-[#0047a8]"
      >
        <Headphones className="h-4 w-4" aria-hidden /> Play narration (browser TTS)
      </button>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-800">
        {lines.map((ln, i) => (
          <li key={i}>{ln}</li>
        ))}
      </ol>
    </div>
  );
}

function DataTable({ payload }: { payload: Record<string, unknown> }) {
  const tb = payload.data_table as { title?: string; headers?: string[]; rows?: string[][] };
  const headers = tb?.headers?.length ? tb.headers : ["Concept", "Explanation"];
  const rows = Array.isArray(tb?.rows) ? tb.rows : [];
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Table2 className="h-4 w-4 text-[#0056D2]" aria-hidden /> Structured reference
      </div>
      {tb?.title ? <div className="mb-2 text-sm font-semibold text-slate-900">{tb.title}</div> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-800">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : [["—", "Add material in syllabus"]]).map((r, ri) => (
              <tr key={ri} className="even:bg-[#fafbfc]">
                {headers.map((_, ci) => (
                  <td key={ci} className="border-b border-slate-100 px-3 py-2 text-slate-800">
                    {r[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Simple pair-matching minigame */
function MatchGame({ payload }: { payload: Record<string, unknown> }) {
  const gm = payload.game as { instructions?: string; pairs?: { a?: string; b?: string; term?: string; definition?: string }[] };
  type Pair = { a: string; b: string };
  const rawPairs = Array.isArray(gm?.pairs) ? gm!.pairs! : [];
  const normalized = useMemo(() => {
    return rawPairs
      .map((p): Pair | null => {
        const a = p.a ?? p.term;
        const b = p.b ?? p.definition;
        if (typeof a !== "string" || typeof b !== "string") return null;
        return { a: a.slice(0, 140), b: b.slice(0, 140) };
      })
      .filter((x): x is Pair => x !== null && x.a !== "" && x.b !== "");
  }, [JSON.stringify(rawPairs)]);

  type Cell = { id: string; text: string; pairKey: number; flipped: boolean; matched: boolean };
  const cells = useMemo(() => {
    const out: Cell[] = [];
    normalized.forEach((p, pk) => {
      out.push({ id: crypto.randomUUID(), text: p.a, pairKey: pk, flipped: false, matched: false });
      out.push({ id: crypto.randomUUID(), text: p.b, pairKey: pk, flipped: false, matched: false });
    });
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, [normalized]);

  const [firstId, setFirstId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [board, setBoard] = useState(cells);

  useEffect(() => {
    setBoard(cells);
    setFirstId(null);
    setBusy(false);
    setMatchedCount(0);
  }, [cells]);

  const onPick = (id: string) => {
    if (busy) return;
    const cell = board.find((c) => c.id === id);
    if (!cell || cell.matched || cell.flipped) return;

    if (!firstId) {
      setFirstId(id);
      setBoard((b) => b.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
      return;
    }

    const first = board.find((c) => c.id === firstId);
    if (!first || first.id === id) return;

    setBusy(true);
    setBoard((b) => b.map((c) => (c.id === id ? { ...c, flipped: true } : c)));

    window.setTimeout(() => {
      setBoard((b) => {
        const a = b.find((c) => c.id === firstId)!;
        const bee = b.find((c) => c.id === id)!;
        const match = a.pairKey === bee.pairKey;
        if (match) {
          setMatchedCount((m) => m + 2);
          return b.map((c) => (c.id === a.id || c.id === bee.id ? { ...c, matched: true, flipped: true } : c));
        }
        return b.map((c) => (c.id === a.id || c.id === bee.id ? { ...c, flipped: false } : c));
      });
      setFirstId(null);
      setBusy(false);
    }, 620);
  };

  const totalPairs = normalized.length * 2;
  const done = totalPairs && matchedCount >= totalPairs;

  if (!normalized.length) {
    return <p className="text-sm text-slate-600">No pairs for this activity yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Puzzle className="h-4 w-4 text-[#0056D2]" aria-hidden /> Interactive match
      </div>
      <p className="mb-4 text-sm text-slate-700">{gm?.instructions ?? "Match related cards."}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {board.map((cell) => (
          <button
            key={cell.id}
            type="button"
            disabled={cell.matched}
            onClick={() => onPick(cell.id)}
            className={clsx(
              "min-h-[76px] rounded-xl border px-2 py-2 text-center text-xs font-medium transition",
              cell.matched ? "border-emerald-400 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-900",
              cell.flipped ? "opacity-100" : "bg-slate-100 text-transparent"
            )}
          >
            {cell.flipped || cell.matched ? cell.text : "?"}
          </button>
        ))}
      </div>
      {done ? (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Great work — pathway complete for this milestone.
        </p>
      ) : null}
    </div>
  );
}
