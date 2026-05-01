import { chatJson, groqChatJson } from "../groqClient";
import type { DiagnosticQuestion, DifficultyLevel, LessonKind, LessonPayload, TutorCourse, TutorLesson, TutorModule } from "./types";
import { defaultStudyDaysMask } from "./types";
import { rebuildSchedule } from "./schedulePlans";
import { coerceSlideDeckFromPayload, ensureNonEmptyDeck } from "./slideDeck";

const MAX_SOURCE = 16_000;

function clip(s: string) {
  return s.length > MAX_SOURCE ? `${s.slice(0, MAX_SOURCE)}\n...[truncated]` : s;
}

function asObj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

export function difficultyFromPlacementScore(scorePct: number): DifficultyLevel {
  if (scorePct >= 75) return "advanced";
  if (scorePct >= 45) return "intermediate";
  return "beginner";
}

const KINDS = new Set<LessonKind>([
  "slides",
  "flashcards",
  "mindmap",
  "reading",
  "infographic",
  "quiz",
  "audio_script",
  "data_table",
  "game"
]);

function coerceKind(k: unknown): LessonKind {
  const s = typeof k === "string" ? k.toLowerCase().replace(/\s+/g, "_") : "";
  if (s === "audio" || s === "podcast") return "audio_script";
  if (s === "table") return "data_table";
  if (s === "report") return "reading";
  if (s === "mcq") return "quiz";
  if (KINDS.has(s as LessonKind)) return s as LessonKind;
  return "reading";
}

function coerceMindmapBranches(raw: unknown): { label: string; children?: string[] }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((br) => {
      const o = asObj(br) ?? {};
      const label = typeof o.label === "string" ? o.label : typeof o.title === "string" ? o.title : "";
      let children: string[] | undefined = undefined;
      if (Array.isArray(o.children)) children = o.children.map(String).filter(Boolean);
      else if (Array.isArray(o.subtopics)) children = o.subtopics.map(String).filter(Boolean);
      return { label: label || "Concept", ...(children?.length ? { children } : {}) };
    })
    .filter((x) => x.label);
}

function normalizeQuizQuestions(qs: unknown[]) {
  return qs
    .map((qi) => {
      const oo = asObj(qi) ?? {};
      const prompt =
        typeof oo.prompt === "string"
          ? oo.prompt
          : typeof oo.question === "string"
            ? oo.question
            : "";
      const optsRaw = oo.options ?? oo.choices ?? oo.answer_choices;
      const opts = Array.isArray(optsRaw) ? optsRaw.map((x) => String(x)) : [];
      let correctIndex = typeof oo.correctIndex === "number" ? oo.correctIndex : 0;
      if (correctIndex >= opts.length || correctIndex < 0) correctIndex = 0;
      return { prompt, options: opts, correctIndex };
    })
    .filter((q) => q.prompt.trim() && Array.isArray(q.options) && q.options.length >= 2);
}

/** Default memorization cues when AI returns no cards */
function defaultFlashcards(lessonTitle: string): { front: string; back: string }[] {
  const t = lessonTitle.trim() || "this topic";
  return [
    { front: `Define: ${t} (high level)`, back: "Write one precise sentence from your syllabus or textbook." },
    { front: "Why does this matter for decisions?", back: "Name one stakeholder decision it improves." },
    { front: "Key prerequisite", back: "List one foundational idea you must know first." },
    { front: "Common pitfall #1", back: "Capture a misconception and correct it succinctly." },
    { front: "Metric / indicator", back: "What would you measure to see progress?" },
    { front: "Example from practice", back: "Give a realistic scenario grounded in coursework." },
    { front: "Compare / contrast cue", back: "What is it NOT the same as, and why?" },
    { front: "Interview-style question", back: "How would you explain this in ~30 seconds aloud?" },
    { front: "Self-check recall", back: "Close the flashcard side and restate definition from memory." },
    { front: "Transfer probe", back: "How would this change if assumptions shifted?" },
    { front: "Edge case / constraint", back: "Name a boundary condition that challenges the naive approach." },
    { front: "Next study action", back: "What’s the next exercise you should attempt?" }
  ];
}

export function normalizeLessonPayload(kind: LessonKind, payload: LessonPayload, lessonTitle: string, lessonMinutes?: number): LessonPayload {
  if (kind === "flashcards") {
    const inner = Array.isArray((payload as { flashcards?: unknown }).flashcards)
      ? (payload as { flashcards: unknown[] }).flashcards
      : payload.cards ?? payload.flashcard;
    const arr = Array.isArray(inner) ? inner : [];
    const cards = arr
      .map((c) => {
        const o = asObj(c) ?? {};
        const front =
          typeof o.front === "string"
            ? o.front
            : typeof o.term === "string"
              ? o.term
              : typeof o.question === "string"
                ? o.question
                : "";
        const back =
          typeof o.back === "string"
            ? o.back
            : typeof o.definition === "string"
              ? o.definition
              : typeof o.answer === "string"
                ? o.answer
                : "";
        return { front: front.trim(), back: back.trim() };
      })
      .filter((c) => c.front.length > 2 && c.back.length > 2);
    return { flashcards: cards.length ? cards : defaultFlashcards(lessonTitle) };
  }
  if (kind === "slides") {
    const merged = asObj(payload) ?? {};
    const deck = ensureNonEmptyDeck(coerceSlideDeckFromPayload(merged), lessonTitle);
    return { slides: deck };
  }
  if (kind === "mindmap") {
    const m = payload.mindmap ?? payload.map ?? payload.tree ?? payload.concept_map;
    if (m && typeof m === "object") {
      const o = asObj(m) ?? {};
      const topic = typeof o.topic === "string" ? o.topic : typeof o.center === "string" ? o.center : lessonTitle;
      const branches = coerceMindmapBranches(o.branches ?? o.nodes ?? o.ideas);
      if (branches.length) return { mindmap: { topic, branches } };
    }
    return {
      mindmap: {
        topic: lessonTitle,
        branches: [
          { label: "Foundations", children: ["definitions", "assumptions", "constraints"] },
          { label: "Methods / process", children: ["steps", "decision criteria", "common pitfalls"] },
          { label: "Applications", children: ["real examples", "stakeholders", "success signals"] },
          { label: "Checks for understanding", children: ["self-quiz cues", "common misconceptions"] }
        ]
      }
    };
  }
  if (kind === "reading") {
    const readingBlock = asObj(payload.reading);
    const secs =
      payload.sections ??
      readingBlock?.sections ??
      (Array.isArray(readingBlock?.body)
        ? [{ heading: lessonTitle, body: readingBlock?.body }]
        : undefined) ??
      (Array.isArray(payload.paragraphs) ? [{ heading: lessonTitle, body: payload.paragraphs }] : undefined);
    if (Array.isArray(secs)) {
      const sections = secs
        .map((sec) => {
          const oo = asObj(sec) ?? {};
          const heading = typeof oo.heading === "string" ? oo.heading : typeof oo.title === "string" ? oo.title : "Section";
          const bodyRaw = oo.body ?? oo.paragraphs;
          let body = Array.isArray(bodyRaw) ? bodyRaw.map((x) => String(x)).filter(Boolean) : [];
          if (!body.length && typeof oo.text === "string") body = [oo.text];
          return { heading: heading.trim() || "Section", body };
        })
        .filter((s) => s.body.some((x) => x.trim().length > 1));
      if (sections.length) return { sections };
    }
    return {
      sections: [
        {
          heading: `What "${lessonTitle}" is about`,
          body: [
            "Read this section actively: underline definitions, jot down unfamiliar terms, and write one sentence describing the main claim.",
            "Connect the concepts to examples you remember from class or your syllabus—prior knowledge speeds retention.",
            "Create a checklist of prerequisites you believe are required to understand this material."
          ]
        },
        {
          heading: "How to engage with this material",
          body: [
            "Skim headings first for structure, then re-read slower on the toughest paragraph.",
            "After reading, summarize in your own words before moving to quizzes or slides.",
            "If something is ambiguous, formulate a clarification question you'd ask your instructor."
          ]
        },
        {
          heading: "Next practice step",
          body: ["Before leaving this lesson: write 5 bullet ‘takeaways’ you want to recall on exam week."]
        }
      ]
    };
  }
  if (kind === "infographic") {
    const o = asObj(payload.infographic) ?? {};
    const rawHl = Array.isArray(o.highlights) ? o.highlights : Array.isArray(o.stats) ? o.stats : [];
    const highlights =
      rawHl.length > 0
        ? rawHl.map((h) => {
            const ih = asObj(h) ?? {};
            return {
              label: String(ih.label ?? ih.metric ?? ih.name ?? ih.title ?? "Point"),
              value: String(ih.value ?? ih.stat ?? ih.text ?? ih.description ?? "—")
            };
          })
        : [
            { label: "Purpose", value: lessonTitle.slice(0, 120) || "Understand the lesson objective clearly." },
            { label: "Core idea #1", value: "What change or decision this topic improves." },
            { label: "Core idea #2", value: "What inputs/tradeoffs matter operationally." },
            { label: "Signal / metric", value: "What you would monitor to judge success." },
            { label: "Risk / pitfall", value: "A common mistake and how to avoid it." },
            { label: "Next action", value: "One practical task to apply learning today." }
          ];
    while (highlights.length < 6) {
      highlights.push({ label: `Detail ${highlights.length + 1}`, value: `How “${lessonTitle}” relates to your broader course goals.` });
    }
    return {
      infographic: {
        title: String(o.title ?? payload.title ?? `Visual digest · ${lessonTitle}`),
        highlights: highlights.slice(0, 12),
        note: typeof o.note === "string" ? o.note : undefined
      }
    };
  }
  if (kind === "quiz") {
    const pq = asObj(payload.quiz);
    let qsUnknown: unknown =
      pq && Array.isArray(pq.questions)
        ? pq.questions
        : pq && Array.isArray((pq as { items?: unknown }).items)
          ? (pq as { items: unknown[] }).items
          : Array.isArray(payload.questions)
            ? payload.questions
            : Array.isArray(payload.items)
              ? payload.items
              : [];
    let qsArr = normalizeQuizQuestions(Array.isArray(qsUnknown) ? qsUnknown : []);
    qsArr = qsArr.map((q) => {
      const opts = [...q.options];
      while (opts.length < 4) {
        opts.push(`Option ${opts.length + 1}`);
      }
      return {
        prompt: q.prompt,
        options: opts.slice(0, 8),
        correctIndex: Math.min(Math.max(q.correctIndex, 0), opts.length - 1)
      };
    });

    let targetQuiz = Math.min(14, Math.max(lessonMinutes ? Math.round((lessonMinutes + 35) / 10) + 4 : 8, qsArr.length, 8));
    while (qsArr.length < targetQuiz) {
      const n = qsArr.length + 1;
      qsArr.push({
        prompt: `“${lessonTitle}”: identify the strongest answer (${n}/${targetQuiz}).`,
        options: [
          "Uses precise terminology and aligns with causal structure from your materials.",
          "Sounds plausible but skips a key prerequisite or ignores constraints.",
          "Reverses an important implication or cites the wrong stakeholder.",
          "Introduces jargon from an unrelated discipline that does not belong here."
        ],
        correctIndex: 0
      });
    }

    return { quiz: { questions: qsArr.slice(0, 14) } };
  }
  if (kind === "audio_script") {
    const au = asObj(payload.audio_script);
    let linesUnknown: unknown =
      au?.lines ??
      au?.script ??
      payload.lines ??
      payload.script ??
      (Array.isArray(payload.paragraphs) ? payload.paragraphs : []);
    const flat = Array.isArray(linesUnknown)
      ? linesUnknown.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      : [String(linesUnknown)];
    const lines = flat.map((x) => x.trim()).filter(Boolean);
    const fillers = [
      `Let’s revisit “${lessonTitle}” aloud for clarity.`,
      "Pause often: summarize each chunk in plain language.",
      "Name one example from your syllabus that fits this lesson.",
      "Ask yourself: why does this insight matter?",
      "List two misconceptions students often confuse here.",
      "Finally, rehearse definitions like you’re tutoring a roommate.",
      "If you stalled, rewind one sentence—slow beats confused.",
      "Close your eyes once and restate one definition from memory.",
      "Add a deliberate pause after each takeaway line."
    ];
    let out = [...lines];
    for (const fn of fillers) {
      if (out.length >= 16) break;
      if (!out.includes(fn)) out.push(fn);
    }
    return { audio_script: { lines: out.length ? out : ["Practice reading this script slowly and clearly."] } };
  }
  if (kind === "data_table") {
    const t = asObj(payload.data_table) ?? payload;
    const headers = Array.isArray((t as { headers?: unknown }).headers)
      ? ((t as { headers: unknown[] }).headers as string[])
      : ["Column A", "Column B"];
    let rows = Array.isArray((t as { rows?: unknown }).rows) ? ((t as { rows: unknown }).rows as string[][]) : [];
    const titleTbl = typeof (t as { title?: unknown }).title === "string" ? (t as { title: string }).title : `${lessonTitle} · reference`;
    if (!rows.length) {
      rows = [
        ["Definition", `What “${lessonTitle}” means in your coursework.`],
        ["Audience", "Who uses this outcome and why it matters to them."],
        ["Inputs", "Facts, assumptions, or prerequisites it depends on."],
        ["Output / decision", "Tangible artifact or judgment it produces."],
        ["Risk", "Primary misconception or failure mode."],
        ["Validation", "One quick check before you trust your answer."]
      ];
    }
    return {
      data_table: {
        title: titleTbl,
        headers: headers.length ? headers : ["Dimension", "What to record"],
        rows
      }
    };
  }
  if (kind === "game") {
    const g = payload.game ?? payload;
    const pairsRaw = Array.isArray((g as { pairs?: unknown }).pairs)
      ? (g as { pairs: unknown }).pairs
      : Array.isArray((g as { matches?: unknown }).matches)
        ? (g as { matches: unknown }).matches
        : [];
    let pairsArr = Array.isArray(pairsRaw)
      ? pairsRaw
          .map((p) => {
            const oo = asObj(p) ?? {};
            const a = oo.a ?? oo.term ?? oo.left ?? oo.concept;
            const b = oo.b ?? oo.definition ?? oo.right ?? oo.meaning;
            if (typeof a !== "string" || typeof b !== "string") return null;
            return { a: a.slice(0, 160).trim(), b: b.slice(0, 200).trim() };
          })
          .filter((x): x is { a: string; b: string } => x !== null && x.a !== "" && x.b !== "")
      : [];
    const instructions =
      typeof (g as { instructions?: unknown }).instructions === "string"
        ? (g as { instructions: string }).instructions
        : "Match concepts with definitions — flip two cards.";
    const padGame = [...pairsArr];
    while (padGame.length < 8) {
      const i = padGame.length + 1;
      padGame.push({
        a: `${lessonTitle} · term ${i}`,
        b: `A precise explanation you could defend on an exam (${i}).`
      });
    }
    return { game: { instructions, pairs: padGame.slice(0, 16) } };
  }
  return payload;
}

function parseLesson(modId: string, raw: Record<string, unknown>): TutorLesson {
  const title = typeof raw.title === "string" ? raw.title : "Lesson";
  const kind = coerceKind(raw.kind);
  const minutes = typeof raw.minutes === "number" ? raw.minutes : typeof raw.estimatedMinutes === "number" ? raw.estimatedMinutes : 15;
  const payloadIn = asObj(raw.payload) ?? {};
  const payload = normalizeLessonPayload(kind, payloadIn, title, minutes);
  return {
    id: crypto.randomUUID(),
    moduleId: modId,
    title,
    kind,
    minutesEstimate: Math.max(5, Math.min(180, minutes)),
    payload
  };
}

function parseModule(raw: Record<string, unknown>): TutorModule {
  const title = typeof raw.title === "string" ? raw.title : "Module";
  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const hours = typeof raw.hours === "number" ? raw.hours : typeof raw.hoursToComplete === "number" ? raw.hoursToComplete : 2;
  const modId = crypto.randomUUID();
  const ls = raw.lessons;
  const lessonArr = Array.isArray(ls) ? ls.map((item) => parseLesson(modId, asObj(item as unknown) ?? {})) : [];

  let lessons =
    lessonArr.length > 0
      ? lessonArr
      : [
          parseLesson(modId, { title: "Orientation", kind: "reading", minutes: 15, payload: {} }),
          parseLesson(modId, { title: "Practice quiz", kind: "quiz", minutes: 20, payload: {} })
        ];
  return {
    id: modId,
    title,
    summary,
    hoursToComplete: Math.max(0.5, hours),
    lessons
  };
}

function ensureModuleSummaries(modules: TutorModule[]): TutorModule[] {
  return modules.map((m) => ({
    ...m,
    summary:
      typeof m.summary === "string" && m.summary.trim().length > 24
        ? m.summary.trim()
        : `${m.title}: practice grounded in your materials — vocabulary, worked examples, and short checks so you can explain ideas clearly.`
  }));
}

type LessonOutlineEntry = {
  id: string;
  moduleTitle: string;
  moduleSummary: string;
  lessonTitle: string;
  kind: LessonKind;
  minutes: number;
};

function lessonOutlinesFromModules(modules: TutorModule[]): LessonOutlineEntry[] {
  const out: LessonOutlineEntry[] = [];
  for (const m of modules) {
    for (const l of m.lessons) {
      out.push({
        id: l.id,
        moduleTitle: m.title,
        moduleSummary: m.summary ?? "",
        lessonTitle: l.title,
        kind: l.kind,
        minutes: l.minutesEstimate
      });
    }
  }
  return out;
}

function remapModulesWithPayloads(modules: TutorModule[], merged: Record<string, LessonPayload>): TutorModule[] {
  return modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((lesson) => {
      const patch = merged[lesson.id];
      if (!patch || typeof patch !== "object") return lesson;
      const coerced = asObj(patch as unknown) ?? {};
      return {
        ...lesson,
        payload: normalizeLessonPayload(lesson.kind, coerced, lesson.title, lesson.minutesEstimate)
      };
    })
  }));
}

const SYS_ENRICH = `You are STEVE Intelligent Tutor. Expand lesson payloads grounded in SOURCE_MATERIAL.
Respond with JSON ONLY: { "payloads": { "<lessonId>": <payloadObject> } }

For each lesson id supplied, output a COMPLETE payload for that lesson's KIND using concrete syllabus-specific wording when possible—not vague filler.

Top-level envelope MUST match KIND (nested keys matter):
- slides: { "slides": [ {"title":"", "bullets":["", ...] }, ... ] } — ≥3 slides, ≥4 bullets each.
- flashcards: { "flashcards": [ {"front":"", "back":"" }, ... ] } — ≥10.
- mindmap: { "mindmap": {"topic":"", "branches":[ {"label":"", "children":[""]}
] } } — ≥4 branches with children.
- reading: { "sections": [ {"heading":"", "body":["",""] }, ... ] } — ≥3 sections, ≥2 sentences per body item.
- infographic: { "infographic": {"title":"", "highlights":[ {"label":"", "value":"" }, ... ], "note":"" } } — ≥6 highlights.
- quiz: { "quiz": {"questions":[{"prompt":"", "options":["","","",""], "correctIndex":0 }] } } — question count should scale with minutes (about 8–14 for typical lessons).
- audio_script: { "audio_script": {"lines":["", ...] } } — ≥14 short lines for narration.
- data_table: { "data_table": {"title":"", "headers":["",""], "rows":[ ["",""], ... ] } } — ≥6 data rows (not counting header labels).
- game: { "game": {"instructions":"", "pairs":[ {"a":"", "b":"" }, ... ] } } — ≥8 pairs.

Always nest under the key shown (e.g. quiz under "quiz"). Return payloads for EVERY id in LESSONS_JSON.`;

async function enrichLessonPayloadsWithGroq(
  modules: TutorModule[],
  syllabus: string,
  band: DifficultyLevel,
  subject: string
): Promise<TutorModule[]> {
  const outlines = lessonOutlinesFromModules(modules);
  if (!outlines.length) return modules;

  const CHUNK = 6;
  const combined: Record<string, LessonPayload> = {};
  for (let i = 0; i < outlines.length; i += CHUNK) {
    const chunk = outlines.slice(i, i + CHUNK);
    const user = `SUBJECT: ${subject}
STUDENT_BAND: ${band}

SOURCE_MATERIAL:
${clip(syllabus)}

LESSONS_JSON:
${JSON.stringify(chunk)}

Return {"payloads":{...}} with one object per lesson id from LESSONS_JSON.`;
    try {
      const raw = await chatJson(SYS_ENRICH, user);
      const root = asObj(raw as unknown);
      const bag = asObj(root?.payloads) ?? null;
      if (bag) {
        for (const [k, v] of Object.entries(bag)) {
          if (v && typeof v === "object") combined[k] = v as LessonPayload;
        }
      }
    } catch {
      /* keep existing payloads; normalizePayload will still pad */
    }
  }
  return remapModulesWithPayloads(modules, combined);
}

function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          "the",
          "and",
          "for",
          "with",
          "from",
          "that",
          "this",
          "into",
          "your",
          "you",
          "are",
          "was",
          "were",
          "their",
          "they",
          "them",
          "have",
          "has",
          "had",
          "not",
          "but",
          "can",
          "will",
          "should"
        ].includes(w)
    );
}

function bestSnippets(source: string, query: string, limit = 20) {
  const terms = new Set(tokenize(query));
  if (!source.trim() || terms.size === 0) return [];
  const sentences = source
    .replace(/\n+/g, "\n")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 45 && x.length < 320);
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

const SYS_MODULE_PACK = `You are STEVE Intelligent Tutor. Produce a module learning pack grounded in SOURCE_EXCERPTS.
Return JSON ONLY shaped as:
{
  "objectives": string[],
  "workedExample": { "prompt": "", "walkthrough": ["", ""], "checkYourWork": ["", ""] },
  "diagram": {
    "title": "",
    "nodes": [ { "id":"n1", "label":"", "x": 0.2, "y": 0.3 } ],
    "edges": [ { "from":"n1", "to":"n2", "label":"" } ]
  },
  "ppt": { "slides": [ { "title": "", "bullets": ["", "", "", ""] }, ... ] },
  "infographic": { "title": "", "highlights": [ { "label": "", "value": "" }, ... ], "note": "" },
  "reading": { "sections": [ { "heading": "", "body": ["", ""] }, ... ] },
  "quiz": { "questions": [ { "prompt":"", "options":["","","",""], "correctIndex":0 } ] },
  "audio_script": { "lines": ["", "", "..."] }
}

Rules:
- PPT must have EXACTLY 5 slides. Each slide: 4–6 bullets. Bullets must be concrete and study-able (definitions, steps, checks).
- Objectives: 4–6 measurable outcomes ("You can...").
- Worked example must be derived from SOURCE_EXCERPTS and include a short walkthrough + checks.
- Diagram must have 4–7 nodes and show relationships/flow for the module; x/y are normalized 0..1.
- Quiz: 8–12 questions tied to the module and worked example.
- Infographic must have 6–10 highlights.
- Reading must be at least 4 sections and MUST include: objectives, worked example, common pitfalls, and a short practice plan.
- Audio script: 14–22 short narration lines summarizing the module in a teaching tone.
- Do NOT write generic filler. If SOURCE_EXCERPTS are sparse, be honest and ask the student to add missing pages, but still create the best possible study pack.
`;

async function ensureModuleOverviewLessons(args: {
  modules: TutorModule[];
  syllabus: string;
  band: DifficultyLevel;
  subject: string;
}): Promise<TutorModule[]> {
  const out: TutorModule[] = [];
  for (const m of args.modules) {
    const query = [m.title, m.summary, ...m.lessons.map((l) => l.title).slice(0, 8)].join(" ");
    const excerpts = bestSnippets(args.syllabus, query, 18);
    const src = excerpts.length ? excerpts.join("\n") : clip(args.syllabus);

    let pack: Record<string, unknown> | null = null;
    try {
      const user = `SUBJECT: ${args.subject}
STUDENT_BAND: ${args.band}
MODULE_TITLE: ${m.title}
MODULE_LESSONS: ${JSON.stringify(m.lessons.map((l) => ({ title: l.title, kind: l.kind, minutes: l.minutesEstimate })))}

SOURCE_EXCERPTS:
${src}
`;
      const raw = await chatJson(SYS_MODULE_PACK, user);
      pack = asObj(raw as unknown);
    } catch {
      pack = null;
    }

    const diagram = asObj(pack?.diagram) ?? null;
    const pptPayload = normalizeLessonPayload("slides", asObj(pack?.ppt) ?? (pack?.ppt as any) ?? {}, `Module overview slides: ${m.title}`, 18) as any;
    if (diagram) (pptPayload as any).diagram = diagram;
    const infoPayload = normalizeLessonPayload("infographic", { infographic: pack?.infographic ?? {} } as any, `Module overview infographic: ${m.title}`, 12) as any;
    const readPayload = normalizeLessonPayload("reading", asObj(pack?.reading) ?? (pack?.reading as any) ?? {}, `Module overview notes: ${m.title}`, 22) as any;
    const audioPayload = normalizeLessonPayload("audio_script", { audio_script: pack?.audio_script ?? {} } as any, `Module overview audio: ${m.title}`, 12) as any;
    const quizPayload = normalizeLessonPayload("quiz", { quiz: pack?.quiz ?? {} } as any, `Module practice quiz: ${m.title}`, 18) as any;

    const mk = (kind: LessonKind, title: string, minutes: number, payload: LessonPayload): TutorLesson => ({
      id: crypto.randomUUID(),
      moduleId: m.id,
      kind,
      title,
      minutesEstimate: minutes,
      payload
    });

    // Always put a real study pack at the top of each module.
    const injected = [
      mk("slides", `Module PPT deck: ${m.title}`, 18, pptPayload),
      mk("reading", `Module study notes: ${m.title}`, 22, readPayload),
      mk("quiz", `Module practice quiz: ${m.title}`, 18, quizPayload),
      mk("audio_script", `Module audio summary: ${m.title}`, 10, audioPayload),
      mk("infographic", `Module visual digest: ${m.title}`, 12, infoPayload)
    ];

    out.push({ ...m, lessons: [...injected, ...m.lessons] });
  }
  return out;
}

function isModulePackLessonTitle(t: string) {
  const s = t.toLowerCase();
  return (
    s.startsWith("module ppt deck:") ||
    s.startsWith("module study notes:") ||
    s.startsWith("module practice quiz:") ||
    s.startsWith("module audio summary:") ||
    s.startsWith("module visual digest:")
  );
}

/**
 * Rebuild one module's study pack (PPT/notes/audio/visual) from stored sourceText.
 * This is used when the user already has a saved course and wants real content without recreating the whole course.
 */
export async function regenerateModulePack(course: TutorCourse, moduleId: string): Promise<TutorCourse> {
  const syllabus = (course.sourceText ?? course.sourceSnippet ?? "").trim();
  if (!syllabus) return course;
  const mods = course.modules.map((m) => {
    if (m.id !== moduleId) return m;
    const cleaned = m.lessons.filter((l) => !isModulePackLessonTitle(l.title));
    return { ...m, lessons: cleaned };
  });
  const rebuilt = await ensureModuleOverviewLessons({
    modules: mods,
    syllabus,
    band: course.difficultyBand,
    subject: course.subject
  });
  return rebuildSchedule({ ...course, modules: rebuilt });
}

function ensureCapstoneGame(modules: TutorModule[]): TutorModule[] {
  if (!modules.length) return modules;
  const last = modules[modules.length - 1];
  const hasGame = last.lessons.some((l) => l.kind === "game");
  if (hasGame) return modules;
  const gameLesson = parseLesson(last.id, {
    title: "Capstone mastery game",
    kind: "game",
    minutes: 25,
    payload: {
      game: {
        instructions: "Match each term with the best explanation.",
        pairs: [
          { a: "Recall", b: "Fetch knowledge from memory" },
          { a: "Transfer", b: "Apply ideas in a new context" },
          { a: "Metacognition", b: "Thinking about how you learn" },
          { a: "Spacing", b: "Review over several sessions" }
        ]
      }
    }
  });
  return [...modules.slice(0, -1), { ...last, lessons: [...last.lessons, gameLesson] }];
}

function modulesFromAi(root: Record<string, unknown>): TutorModule[] {
  const mods = root.modules ?? root.courseModules;
  if (!Array.isArray(mods)) return [];
  return mods.map((m) => parseModule(asObj(m as unknown) ?? {}));
}

export function buildCourseSkeleton(args: {
  title: string;
  subject: string;
  syllabus: string;
  weeksTotal: number;
  hoursPerWeek: number;
  learningStartISO: string;
  difficultyBand: DifficultyLevel;
  studyDaysMask: boolean[];
  diagnostic?: TutorCourse["diagnostic"];
}): TutorCourse {
  return {
    id: crypto.randomUUID(),
    title: args.title,
    subtitle: undefined,
    subject: args.subject,
    createdAtISO: new Date().toISOString(),
    sourceSnippet: clip(args.syllabus).slice(0, 520),
    sourceText: clip(args.syllabus),
    outcomes: [],
    skillsTags: [],
    toolsTags: [],
    weeksTotal: args.weeksTotal,
    hoursPerWeek: args.hoursPerWeek,
    learningStartISO: args.learningStartISO || new Date().toISOString(),
    studyDaysMask: args.studyDaysMask.length === 7 ? args.studyDaysMask : defaultStudyDaysMask(),
    difficultyBand: args.difficultyBand,
    modules: [],
    diagnostic: args.diagnostic,
    scheduleChunks: []
  };
}

const SYS_PLACEMENT = `You write short placement MCQs from syllabus text ONLY.
Respond with JSON ONLY: { "questions": [ {"prompt":"", "options": ["",""], "correctIndex": 0 } ] }
Rules: Exactly 6 questions unless input is tiny (then still return at least 3).
4 options each, one correct index 0–3.
No preamble.`;

export async function aiGeneratePlacementQuestions(syllabusText: string): Promise<DiagnosticQuestion[]> {
  const raw = await groqChatJson(SYS_PLACEMENT, `SOURCE:\n${clip(syllabusText)}`);
  const o = asObj(raw as unknown);
  const qs = o?.questions;
  if (!Array.isArray(qs)) return [];
  return qs.slice(0, 8).map((q): DiagnosticQuestion => {
    const oo = asObj(q as unknown) ?? {};
    const prompt = typeof oo.prompt === "string" ? oo.prompt : "Question";
    const options = Array.isArray(oo.options) ? (oo.options as unknown[]).map((x) => String(x)).slice(0, 8) : ["A", "B", "C", "D"];
    const correctIndex =
      typeof oo.correctIndex === "number" && oo.correctIndex >= 0 && oo.correctIndex < options.length
        ? oo.correctIndex
        : 0;
    return {
      id: crypto.randomUUID(),
      prompt,
      options: options.length >= 2 ? options : ["Choice A", "Choice B"],
      correctIndex
    };
  });
}

const SYS_COURSE = `You are STEVE Intelligent Tutor. Build dense, practical study modules grounded in SOURCE.
Return VALID JSON ONLY (no Markdown) shaped as:
{
  "title":"",
  "subtitle":"",
  "subject":"",
  "outcomes": string[],
  "skillsTags": string[],
  "toolsTags": string[],
  "modules": [
    {
      "title":"",
      "summary":"",
      "hours": number,
      "lessons": [
        {
          "title":"",
          "kind":"slides|flashcards|mindmap|reading|infographic|quiz|audio_script|data_table|game",
          "minutes": number,
          "payload": {}
        }
      ]
    }
  ]
}
Rules:
- 3–6 modules. Each module 4–7 lessons alternating modalities.
- The course MUST fit the time frame: total module hours should be close to (TARGET_PACE_WEEKS × TARGET_HOURS_PER_WEEK), within ±10%.
- Every lesson MUST ship a substantive payload matching its kind — never "{}"/empty arrays. Prefer terminology and examples from SOURCE.
- Lessons must vary: flashcards decks, infographic highlights, quizzes, readings, slides, mindmaps where useful, data_table rows, audio_script line arrays.
- slides: payload.slides as [ { title, bullets: string[] } ]; ≥3 slides, ≥4 bullets each, all bullets from SOURCE when possible.
- flashcards: ≥10 {front,back} pairs tied to syllabus terms.
- mindmap: { topic, branches:[{label, children:[]}] } with ≥4 branches.
- reading: { sections:[{heading, body:string[]}] } ≥3 sections.
- infographic: { infographic:{ title, highlights:[{label,value}], optional note } } ≥6 highlights.
- quiz: { quiz:{ questions:[{prompt, options(4), correctIndex}] } } scale count with minutes (~8–14).
- audio_script: { audio_script:{ lines:string[] } } ≥14 short lines.
- data_table: { data_table:{ title, headers, rows } } ≥6 rows.
- game: { game:{ instructions, pairs:[{a,b} or {term,definition}] } } ≥8 pairs in FINAL module.
- Difficulty aligns with STUDENT_BAND — beginner repeats foundations, intermediate expects prior basics, advanced is dense.
- Estimated minutes per lesson 8–35.
`;

const SYS_PAGE_GUIDE = `You are STEVE Intelligent Tutor. Explain each PDF page for studying.
Return JSON ONLY: { "pages": [ { "page": 1, "title": "", "summary": "", "keyPoints": ["", ""] } ] }

Rules:
- One object per page in PAGES_JSON.
- title: short (3–8 words).
- summary: 4–8 sentences, study-focused, grounded ONLY in that page text.
- keyPoints: 5–8 bullets; include definitions, steps, and exam-style prompts when possible.
No filler.`;

function parsePagesFromMarkedSource(source: string): string[] {
  // Drop any leading import banners before the first page marker.
  const firstMarker = source.search(/(?:^|\n)\s*(?:===\s*PAGE\s+\d+\s*===|---\s*PAGE\s+\d+\s*(?:\/\s*\d+)?\s*---)\s*/i);
  const usable = firstMarker >= 0 ? source.slice(firstMarker) : source;

  const chunks = usable
    .split(/(?:^|\n)\s*(?:===\s*PAGE\s+\d+\s*===|---\s*PAGE\s+\d+\s*(?:\/\s*\d+)?\s*---)\s*/gim)
    .map((s) => s.trim())
    .filter(Boolean);
  // Fallback: if the user pasted text without page markers, treat it as a single page.
  if (!chunks.length && source.trim()) return [source.trim()];
  return chunks;
}

async function buildPageGuide(source: string): Promise<TutorCourse["pageGuide"]> {
  const pages = parsePagesFromMarkedSource(source);
  if (!pages.length) return undefined;
  const clippedPages = pages.map((p) => p.slice(0, 2000));
  const items = clippedPages.map((text, idx) => ({ page: idx + 1, text }));
  const CHUNK = 6;
  const out: { page: number; title: string; summary: string; keyPoints: string[] }[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const user = `PAGES_JSON:\n${JSON.stringify(chunk)}`;
    try {
      const raw = await chatJson(SYS_PAGE_GUIDE, user);
      const root = asObj(raw as unknown);
      const arr = Array.isArray(root?.pages) ? (root?.pages as unknown[]) : [];
      for (const it of arr) {
        const o = asObj(it) ?? {};
        const page = typeof o.page === "number" ? o.page : undefined;
        if (!page) continue;
        const title = typeof o.title === "string" ? o.title : `Page ${page}`;
        const summary = typeof o.summary === "string" ? o.summary : "";
        const keyPoints = Array.isArray(o.keyPoints) ? (o.keyPoints as unknown[]).map(String).filter(Boolean) : [];
        out.push({ page, title: title.trim() || `Page ${page}`, summary: summary.trim(), keyPoints: keyPoints.slice(0, 10) });
      }
    } catch {
      // keep going
    }
  }
  if (out.length) return out.sort((a, b) => a.page - b.page);

  // Hard fallback (still useful): derive a simple study guide from the page text.
  const fallback = clippedPages.map((text, idx) => {
    const sentences = text
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const title = sentences[0]?.slice(0, 80) || `Page ${idx + 1}`;
    const summary = sentences.slice(0, 6).join(" ").slice(0, 800);
    const keyPoints =
      sentences.slice(0, 8).map((s) => s.slice(0, 180)) ??
      [
        "Skim this page and list key terms.",
        "Write one sentence: what is the main point?",
        "Draft one exam-style question from this page."
      ];
    return { page: idx + 1, title, summary, keyPoints: keyPoints.filter(Boolean).slice(0, 10) };
  });
  return fallback;
}

export async function aiGeneratePersonalizedCourse(args: {
  title: string;
  subject: string;
  syllabus: string;
  weeksTotal: number;
  hoursPerWeek: number;
  learningStartISO: string;
  difficultyBand: DifficultyLevel;
  studyDaysMask: boolean[];
  diagnostic?: TutorCourse["diagnostic"];
}): Promise<TutorCourse> {
  const userPrompt = `
TITLE: ${args.title}
SUBJECT: ${args.subject}
TARGET_PACE_WEEKS: ${args.weeksTotal}
TARGET_HOURS_PER_WEEK: ${args.hoursPerWeek}
START_DATE_ISO_HINT: ${args.learningStartISO}
STUDENT_BAND: ${args.difficultyBand}
SOURCE_MATERIAL:\n${clip(args.syllabus)}
`;
  const raw = await chatJson(SYS_COURSE, userPrompt);
  const root = asObj(raw as unknown) ?? {};

  let modules = ensureCapstoneGame(modulesFromAi(root));
  if (!modules.length) {
    modules = ensureCapstoneGame([
      parseModule({
        title: "Fundamentals refresher",
        summary: "Core ideas from your material.",
        hours: 4,
        lessons: [
          { title: "Orientation reading", kind: "reading", minutes: 18, payload: {} },
          { title: "Key term flashcards", kind: "flashcards", minutes: 20, payload: {} },
          { title: "Knowledge check", kind: "quiz", minutes: 20, payload: {} }
        ]
      })
    ]);
  }

  modules = ensureModuleSummaries(modules);
  modules = await enrichLessonPayloadsWithGroq(modules, args.syllabus, args.difficultyBand, args.subject);
  modules = await ensureModuleOverviewLessons({ modules, syllabus: args.syllabus, band: args.difficultyBand, subject: args.subject });

  const base = buildCourseSkeleton({
    ...args,
    title: typeof root.title === "string" ? root.title : args.title,
    subject: typeof root.subject === "string" ? root.subject : args.subject,
    syllabus: args.syllabus,
    diagnostic: args.diagnostic
  });

  const assembled: TutorCourse = {
    ...base,
    title: typeof root.title === "string" ? root.title : args.title,
    subtitle: typeof root.subtitle === "string" ? root.subtitle : undefined,
    outcomes: Array.isArray(root.outcomes) ? (root.outcomes as unknown[]).map(String) : [],
    skillsTags: Array.isArray(root.skillsTags) ? (root.skillsTags as unknown[]).map(String) : [],
    toolsTags: Array.isArray(root.toolsTags) ? (root.toolsTags as unknown[]).map(String) : [],
    sourceText: clip(args.syllabus),
    sourcePages: parsePagesFromMarkedSource(args.syllabus).map((p) => p.slice(0, 4000)),
    pageGuide: await buildPageGuide(args.syllabus),
    modules,
    diagnostic: args.diagnostic
  };

  return rebuildSchedule(assembled);
}

export function summarizePlacement(args: Pick<TutorCourse, "diagnostic">): number | undefined {
  const d = args.diagnostic;
  if (!d?.questions?.length || !d.answers) return undefined;
  let ok = 0;
  let counted = 0;
  for (const q of d.questions) {
    const ans = d.answers[q.id];
    if (ans === undefined) continue;
    counted++;
    if (ans === q.correctIndex) ok++;
  }
  if (!counted) return undefined;
  return Math.round((ok / counted) * 100);
}
