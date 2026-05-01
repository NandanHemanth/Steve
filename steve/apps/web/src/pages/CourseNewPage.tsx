import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/Button";
import { FileText, UploadCloud } from "lucide-react";
import type { DiagnosticState, DifficultyLevel } from "../lib/tutor/types";
import { defaultStudyDaysMask } from "../lib/tutor/types";
import {
  aiGeneratePersonalizedCourse,
  aiGeneratePlacementQuestions,
  difficultyFromPlacementScore,
  summarizePlacement
} from "../lib/tutor/tutorAi";
import { upsertCourse } from "../lib/tutor/repo";
import { extractPdfForSyllabus, readTextFile, type PdfExtractMeta } from "../lib/tutor/pdfText";
import { useProfile } from "../lib/useProfile";
import { AiErrorBanner } from "../components/ui/AiErrorBanner";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function studyDaysShort(mask: boolean[]): string {
  const pick = days.filter((_, i) => mask[i]);
  return pick.length ? pick.join(", ") : "None";
}

function truncMiddle(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function buildPdfImportPreamble(meta: PdfExtractMeta): string {
  const lines = [
    "=== PDF IMPORT (layout-aware deep text extraction) ===",
    `File: ${meta.fileName}`,
    `Pages: ${meta.pageCount}`,
    `Estimated words extracted: ${meta.wordCount.toLocaleString()}`
  ];
  if (meta.pdfTitle) lines.push(`Document title (metadata): ${meta.pdfTitle}`);
  if (meta.author) lines.push(`Author (metadata): ${meta.author}`);
  lines.push(
    "Structured per page below (--- PAGE N --- blocks). Text preserves line breaks and reading order where the PDF exposes selectable text — scanned images need OCR separately."
  );
  lines.push("");
  return lines.join("\n");
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function defaultsFromProfile(profile: StudentProfile | null) {
  const start = todayStamp();
  const mask = defaultStudyDaysMask();

  const creditComfort = typeof profile?.creditComfort === "number" ? profile.creditComfort : 9;
  const suggestedHours = clampInt(6 + (creditComfort - 9) * 0.8, 2, 18);
  const suggestedWeeks = clampInt(4 + (creditComfort < 9 ? 2 : creditComfort > 12 ? -1 : 0), 1, 16);

  return { start, mask, suggestedHours, suggestedWeeks };
}

export function CourseNewPage() {
  const nav = useNavigate();
  const { profile } = useProfile();
  const defaults = useMemo(() => defaultsFromProfile(profile), [profile]);

  const [autopilot, setAutopilot] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [weeks, setWeeks] = useState(defaults.suggestedWeeks);
  const [hoursPerWeek, setHoursPerWeek] = useState(defaults.suggestedHours);
  const [start, setStart] = useState(defaults.start);
  const [mask, setMask] = useState<boolean[]>(defaults.mask);

  const [usePlacement, setUsePlacement] = useState(true);
  const [placement, setPlacement] = useState<DiagnosticState | undefined>();
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [showPlacementAnswers, setShowPlacementAnswers] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfMeta, setPdfMeta] = useState<PdfExtractMeta | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [pdfObjectUrl]);

  const effectiveWeeks = autopilot ? defaults.suggestedWeeks : weeks;
  const effectiveHours = autopilot ? defaults.suggestedHours : hoursPerWeek;
  const effectiveStart = autopilot ? defaults.start : start;
  const effectiveMask = autopilot ? defaults.mask : mask;
  const syllabusChars = syllabus.length;

  const runPlacement = async () => {
    if (!syllabus.trim()) {
      setErr("Add syllabus text or upload a file first.");
      return;
    }
    setErr(null);
    setLoading("Drafting placement questions…");
    try {
      const questions = await aiGeneratePlacementQuestions(syllabus);
      setShowPlacementAnswers(false);
      setPlacement({ questions, answers: {} });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const skipPlacement = () => {
    setShowPlacementAnswers(false);
    setPlacement({ questions: [], skipped: true });
    setDifficulty("intermediate");
  };

  const applyPlacement = () => {
    if (!placement) return;
    const pct = summarizePlacement({
      diagnostic: { ...placement, answers: placement.answers ?? {} }
    });
    const band = pct != null ? difficultyFromPlacementScore(pct) : "intermediate";
    setDifficulty(band);
    setShowPlacementAnswers(true);
    setPlacement({
      ...placement,
      skipped: false,
      scorePct: pct
    });
  };

  const generateCourse = async () => {
    if (!syllabus.trim()) {
      setErr("Syllabus is required.");
      return;
    }
    setErr(null);
    setLoading("Personalizing your pathway — modules, deadlines & activities…");
    try {
      const diag =
        usePlacement && placement?.questions?.length
          ? ({
              ...placement,
              answers: placement.answers ?? {}
            } as DiagnosticState)
          : undefined;
      if (usePlacement && placement?.questions?.length) applyPlacement();

      const scheduleMask =
        autopilot ? defaults.mask : mask.length === 7 ? mask : defaultStudyDaysMask();
      const course = await aiGeneratePersonalizedCourse({
        title: title.trim() || "Personalized tutor track",
        subject: subject.trim() || "General",
        syllabus,
        weeksTotal: autopilot ? defaults.suggestedWeeks : weeks,
        hoursPerWeek: autopilot ? defaults.suggestedHours : hoursPerWeek,
        learningStartISO: new Date(`${effectiveStart}T12:00:00`).toISOString(),
        difficultyBand: difficulty,
        studyDaysMask: scheduleMask,
        diagnostic: diag
      });
      upsertCourse(course);
      nav(`/app/courses/${course.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setErr(null);
    try {
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        setLoading("Extracting PDF text (deep pass)…");
        if (pdfObjectUrl) {
          URL.revokeObjectURL(pdfObjectUrl);
          setPdfObjectUrl(null);
        }
        const objectUrl = URL.createObjectURL(f);
        setPdfObjectUrl(objectUrl);
        const { pages, meta } = await extractPdfForSyllabus(f);
        setPdfMeta(meta);
        const blocks = pages.map((p, i) => `--- PAGE ${i + 1} / ${meta.pageCount} ---\n${p}`).join("\n\n");
        const body = `${buildPdfImportPreamble(meta)}${blocks}`;
        setSyllabus((s) => (s.trim() ? `${s.trim()}\n\n${body}` : body));
      } else if (f.type.startsWith("text/") || f.name.match(/\.(txt|md)$/i)) {
        if (pdfObjectUrl) {
          URL.revokeObjectURL(pdfObjectUrl);
          setPdfObjectUrl(null);
        }
        setPdfMeta(null);
        setShowPdfPreview(false);
        const t = await readTextFile(f);
        const note = `=== TEXT FILE ===\nFile: ${f.name}\n\n`;
        setSyllabus((s) => (s.trim() ? `${s.trim()}\n\n${note}${t}` : `${note}${t}`));
      } else if (f.type.startsWith("image/")) {
        setErr("Images are not auto-read here — describe the page or paste OCR text under your syllabus.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read file.");
    } finally {
      setLoading(null);
    }
  };

  const sidebarCard = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  const panel = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-sm text-slate-600">
        <Link to="/app/dashboard" className="text-[#0056D2] hover:underline">
          Dashboard
        </Link>{" "}
        / New AI course
      </div>
      <div className="mt-2 flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Create an intelligent tutor track</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-700">
            Upload or paste materials once — STEVE builds modules, pacing, and activities. Opens on the course overview when done.
          </p>
        </div>
      </div>

      {err ? (
        <div className="mt-4">
          <AiErrorBanner message={err} onDismiss={() => setErr(null)} />
        </div>
      ) : null}
      {loading ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#0056D2]/25 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0056D2] border-t-transparent" />
          {loading}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,20rem)] lg:items-start xl:gap-8">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <section className={panel}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Working title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Viz with Excel & Cognos"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Subject / program area</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Business Analytics"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                />
              </label>
            </div>

            {/* ── Upload drop zone — PRIMARY CTA ── */}
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,text/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />

              <AnimatePresence mode="wait">
                {pdfMeta ? (
                  /* ── Uploaded state ── */
                  <motion.div
                    key="uploaded"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                        <FileText className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-emerald-900">{pdfMeta.fileName}</div>
                        <div className="text-xs text-emerald-700">
                          {pdfMeta.pageCount} pages · ~{pdfMeta.wordCount.toLocaleString()} words extracted
                          {pdfMeta.pdfTitle ? ` · "${pdfMeta.pdfTitle}"` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
                          setPdfObjectUrl(null); setPdfMeta(null); setShowPdfPreview(false);
                          setSyllabus("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition"
                      >
                        Remove
                      </button>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-emerald-600"
                          checked={showPdfPreview}
                          onChange={(e) => setShowPdfPreview(e.target.checked)}
                        />
                        Preview PDF
                      </label>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Drop zone ── */
                  <motion.button
                    key="dropzone"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={[
                      "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all",
                      dragging
                        ? "border-[#0056D2] bg-[#EEF5FF] scale-[1.01]"
                        : "border-[#0056D2]/40 bg-[#F2F7FF] hover:border-[#0056D2] hover:bg-[#EEF5FF]"
                    ].join(" ")}
                  >
                    <motion.div
                      animate={{ y: dragging ? -6 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0056D2]/10"
                    >
                      <UploadCloud className="h-7 w-7 text-[#0056D2]" />
                    </motion.div>
                    <div>
                      <div className="text-base font-bold text-[#0056D2]">
                        {dragging ? "Drop your file here" : "Upload syllabus or lecture notes"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Drag & drop a <span className="font-semibold">PDF</span> or{" "}
                        <span className="font-semibold">TXT / MD</span> file, or{" "}
                        <span className="font-semibold text-[#0056D2] underline underline-offset-2">click to browse</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Text is extracted per page for deep AI grounding</div>
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>

              {pdfObjectUrl && showPdfPreview && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <iframe title="PDF preview" src={`${pdfObjectUrl}#view=FitH`} className="h-[min(420px,50vh)] w-full" />
                </div>
              )}
            </div>

            {/* ── Syllabus text (secondary) ── */}
            <label className="mt-4 grid gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">
                  Or paste syllabus / notes directly
                </span>
                {syllabusChars ? (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{syllabusChars.toLocaleString()} chars</span>
                ) : null}
              </div>
              <textarea
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                rows={6}
                placeholder="Paste outcomes, weekly topics, reading lists…"
                className="min-h-[120px] rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[#0056D2]/25 lg:min-h-[140px]"
              />
            </label>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Placement quiz (optional)</div>
                <p className="mt-1 text-sm text-slate-700">
                  Short MCQs from your source — used to tune difficulty.
                </p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={usePlacement} onChange={(e) => setUsePlacement(e.target.checked)} />
                Use placement
              </label>
            </div>

            {usePlacement ? (
              <div className="mt-4 space-y-4">
                {!placement?.questions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={runPlacement} disabled={!!loading}>
                      Load MCQs
                    </Button>
                    <Button type="button" variant="ghost" className="border border-slate-200 bg-white" onClick={skipPlacement}>
                      Skip
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-[min(520px,55vh)] space-y-3 overflow-y-auto pr-1">
                    {placement.questions.map((q, qi) => (
                      <div key={q.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {qi + 1}. {q.prompt}
                        </div>
                        <div className="mt-2 grid gap-2">
                          {q.options.map((opt, oi) => (
                            <label
                              key={oi}
                              className={[
                                "flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm",
                                showPlacementAnswers && oi === q.correctIndex ? "bg-emerald-50 text-emerald-950" : "",
                                showPlacementAnswers &&
                                placement.answers?.[q.id] != null &&
                                placement.answers?.[q.id] !== q.correctIndex &&
                                oi === placement.answers?.[q.id]
                                  ? "bg-red-50 text-red-950"
                                  : ""
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name={`pl-${q.id}`}
                                checked={placement.answers?.[q.id] === oi}
                                onChange={() =>
                                  setPlacement((p) =>
                                    p
                                      ? {
                                          ...p,
                                          answers: { ...p.answers, [q.id]: oi }
                                        }
                                      : p
                                  )
                                }
                              />
                              <span className="flex-1">{opt}</span>
                              {showPlacementAnswers && oi === q.correctIndex ? (
                                <span className="text-xs font-semibold text-emerald-800">Correct</span>
                              ) : null}
                              {showPlacementAnswers &&
                              placement.answers?.[q.id] != null &&
                              placement.answers?.[q.id] !== q.correctIndex &&
                              oi === placement.answers?.[q.id] ? (
                                <span className="text-xs font-semibold text-red-800">Your choice</span>
                              ) : null}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pb-2">
                      <Button type="button" onClick={applyPlacement}>
                        Apply results
                      </Button>
                      <Button type="button" variant="ghost" className="border border-slate-200 bg-white" onClick={skipPlacement}>
                        Ignore
                      </Button>
                      {showPlacementAnswers ? (
                        <span className="ml-auto self-center text-xs font-medium text-slate-600">
                          Correct answers shown
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 text-sm text-slate-800">
              <span className="font-semibold">Starting band:</span> {difficulty}
              {placement?.scorePct != null ? ` · placement ${placement.scorePct}%` : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Pacing & deadlines</div>
                <p className="mt-1 text-sm text-slate-700">
                  {autopilot
                    ? `Auto: ~${defaults.suggestedWeeks} weeks × ~${defaults.suggestedHours} h/wk, start ${defaults.start}.`
                    : "Manual timeline and study days below."}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[#0056D2] hover:underline"
                onClick={() => {
                  setAdvanced((was) => {
                    const opening = !was;
                    if (opening) setAutopilot(false);
                    return opening;
                  });
                }}
              >
                {advanced ? "Hide advanced" : "Advanced"}
              </button>
            </div>

            {advanced ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Target weeks</span>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={weeks}
                      onChange={(e) => setWeeks(Number(e.target.value))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Hours per week</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-slate-600">First study day</span>
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div>
                  <div className="text-xs text-slate-600">Study days</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {days.map((d, i) => (
                      <label key={d} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={mask[i]}
                          onChange={(e) => {
                            const next = [...mask];
                            next[i] = e.target.checked;
                            setMask(next);
                          }}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Values above apply when <span className="font-semibold">Autopilot</span> is off. With autopilot on, STEVE keeps
                  schedule from your profile.
                </p>
              </div>
            ) : null}
          </section>

          {/* Mobile/tablet-only generate (sticky sidebar has desktop CTA) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:hidden">
            <Button type="button" className="w-full sm:w-auto" onClick={generateCourse} disabled={!!loading}>
              Generate course
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className={sidebarCard}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Autopilot</div>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={autopilot}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAutopilot(on);
                  if (on) setAdvanced(false);
                }}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">{autopilot ? "On" : "Off"}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {autopilot
                    ? "Schedule from your Intelligent Profile — click Advanced below to expose manual pacing (autopilot turns off automatically)."
                    : "Manual weeks, hours, start date & study days are used for this course."}
                </p>
              </div>
            </label>
          </div>

          <div className={sidebarCard}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan preview</div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Title</dt>
                <dd className="max-w-[58%] text-right font-semibold text-slate-900">{title.trim() ? truncMiddle(title.trim(), 40) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Subject</dt>
                <dd className="max-w-[58%] text-right font-semibold text-slate-900">
                  {subject.trim() ? truncMiddle(subject.trim(), 36) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Pacing</dt>
                <dd className="text-right font-semibold text-slate-900">{autopilot ? "Autopilot" : "Manual"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Runway</dt>
                <dd className="font-semibold text-slate-900">{effectiveWeeks} wk</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Study load</dt>
                <dd className="font-semibold text-slate-900">{effectiveHours} h/wk</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Starts</dt>
                <dd className="font-semibold text-slate-900">{effectiveStart}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Study days</dt>
                <dd className="max-w-[60%] text-right text-xs font-semibold leading-snug text-slate-900">
                  {studyDaysShort(effectiveMask)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Source text</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {pdfMeta
                    ? `${pdfMeta.pageCount} pp · ~${pdfMeta.wordCount.toLocaleString()} words`
                    : syllabusChars > 0
                      ? `${syllabusChars.toLocaleString()} chars`
                      : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2">
                <dt className="text-slate-600">Placement</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {usePlacement ? (placement?.questions?.length ? `On · ${placement.questions.length} Q` : "On · pending") : "Off"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <dt className="text-slate-600">Difficulty</dt>
                <dd className="font-semibold capitalize text-slate-900">{difficulty}</dd>
              </div>
            </dl>
          </div>

          <div className={sidebarCard}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick tips</div>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">PDF:</span> text is extracted per page for better grounding.
              </li>
              <li>
                <span className="font-semibold text-slate-900">After:</span> Course overview opens first — then Resume learning.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Modules:</span> Each has a slide deck, notes, audio, infographic, quiz in one pack.
              </li>
            </ul>
          </div>

          <div className={`${sidebarCard} border-[#0056D2]/25 bg-[#F2F7FF]/60`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#0047a8]/80">Generate</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              Mixed formats · deadlines · module pack with PPTX/PDF downloads from slide lessons.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" className="w-full" onClick={generateCourse} disabled={!!loading}>
                Generate course
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full border border-slate-200 bg-white"
                onClick={() => {
                  setAutopilot(true);
                  setAdvanced(false);
                }}
              >
                Reset to autopilot
              </Button>
              <Link
                to="/app/settings"
                className="text-center text-xs font-semibold text-[#0056D2] underline decoration-[#0056D2]/30 underline-offset-2 hover:decoration-[#0056D2]"
              >
                Groq / Hugging Face settings
              </Link>
            </div>
          </div>

          {(profile?.programName || profile?.major) ? (
            <div className={`${sidebarCard} bg-slate-50/90`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile</div>
              <p className="mt-2 text-xs text-slate-700">{profile.programName ?? profile.major}</p>
              <Link to="/app/profile" className="mt-2 inline-block text-xs font-semibold text-[#0056D2] hover:underline">
                Edit profile
              </Link>
            </div>
          ) : (
            <div className={sidebarCard}>
              <Link to="/app/profile" className="text-sm font-semibold text-[#0056D2] hover:underline">
                Add Intelligent Profile →
              </Link>
              <p className="mt-2 text-xs text-slate-600">Improves autopilot pacing and defaults.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
