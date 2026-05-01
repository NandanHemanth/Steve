import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, RefreshCw, Sparkles, Tag, User, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { AiErrorBanner } from "../ui/AiErrorBanner";
import { chatJson } from "../../lib/groqClient";
import { loadJson, storageKeys } from "../../lib/storage";
import type { StudentProfile } from "../../lib/types";
import { useProfile } from "../../lib/useProfile";
import { ALL_PROGRAMS, PROGRAM_LABELS, getProgram, type StevensCourse, type StevensProgram } from "../../data/stevensData";

/** Resolve the Stevens program key from the stored profile — no guessing needed. */
function matchProgramKey(profile: StudentProfile): string {
  // 1. Prefer the explicitly stored key (set via the Program dropdown in Profile Panel)
  if (profile.stevensProgram) {
    const found = ALL_PROGRAMS.find((p) => p.key === profile.stevensProgram);
    if (found) return found.key;
  }
  // 2. Fuzzy match on programName / major as a fallback for old profiles
  const name = (profile.programName ?? profile.major ?? "").toLowerCase().trim();
  if (!name) return ALL_PROGRAMS[0]?.key ?? "";
  const exact = ALL_PROGRAMS.find((p) => p.label.toLowerCase().includes(name));
  if (exact) return exact.key;
  const keywords = name.split(/[\s&,/]+/).filter((w) => w.length > 2);
  const partial = ALL_PROGRAMS.find((p) =>
    keywords.some((kw) => p.label.toLowerCase().includes(kw) || p.key.toLowerCase().includes(kw))
  );
  return partial?.key ?? ALL_PROGRAMS[0]?.key ?? "";
}

export type RecommendedCourse = {
  courseId: string;    // StevensCourse.id
  reason: string;
  semester: string;
  category: string;    // "Core" | "Elective" | pool label
  bucketKey?: string;
};

type RecommendResult = {
  recommended: RecommendedCourse[];
  skillGaps: string[];
  warnings: string[];
};

type Props = {
  profile: StudentProfile;
  onAccept: (course: RecommendedCourse) => void;
  onReject: (courseId: string) => void;
  accepted: Set<string>;
  rejected: Set<string>;
};

function difficultyFromPool(poolKey: string): string {
  if (poolKey.includes("core") || poolKey.includes("foundation")) return "Required";
  if (poolKey.includes("elective") || poolKey.includes("concentration")) return "Elective";
  if (poolKey.includes("capstone") || poolKey.includes("project")) return "Capstone";
  return "Elective";
}

function difficultyColor(d: string) {
  if (d === "Required") return "bg-[#F2F7FF] text-[#0056D2] border-[#0056D2]/30";
  if (d === "Capstone") return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function cardAnim(i: number) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.055, duration: 0.28 } };
}

const MAX_SEM_CREDITS = 12;
const MIN_SEM_CREDITS = 9;
const MAX_SEM_COURSES = 4;

const SYS_PROMPT = `You are STEVE, an intelligent academic advisor for Stevens Institute of Technology graduate students.

Your task: Recommend a healthy selection of 8–12 relevant courses for the student's CURRENT SEMESTER ONLY. This allows the student to choose their preferred load.

CRITICAL RULES:
1. Only recommend courses that exist in PROGRAM_COURSES.
2. Provide a diverse list of 8–12 relevant courses (Core and Electives) so the student has choices.
3. All courses must share the SAME semester (CURRENT_SEMESTER value).
4. Prioritize required/core courses first, then concentration electives and general electives.
5. Verify prerequisites are satisfiable given already completed courses.
6. Match courses to student career goals and background.
7. Provide reasoning for each recommendation based on the student's profile.

Respond ONLY in this exact JSON (no markdown, no text outside JSON):
{
  "recommended": [
    { "courseId": "BIA580", "reason": "...", "semester": "CURRENT_SEMESTER", "category": "Core", "bucketKey": "core" }
  ],
  "skillGaps": ["Python", "Statistics"],
  "warnings": ["BIA656 requires BIA652 — plan accordingly"]
}`;

export function SmartRecommender({ profile, onAccept, onReject, accepted, rejected }: Props) {
  const { updateProfile } = useProfile();

  const [selectedProgramKey, setSelectedProgramKey] = useState<string>(() => matchProgramKey(profile));
  const [selectedConcentration, setSelectedConcentration] = useState<string>(() => profile.concentration ?? "");
  const [jobRole, setJobRole] = useState(() => (profile.careerInterests ?? []).filter(Boolean).join(", "));
  const [background, setBackground] = useState(() => profile.previousDegree?.trim() ?? "");
  const [currentSemester, setCurrentSemester] = useState(() => profile.currentSemester?.trim() ?? "");
  const [isF1, setIsF1] = useState(profile.isF1Student ?? false);
  const [profileRefreshed, setProfileRefreshed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);

  // Re-sync ALL fields from profile when it changes (user edits Profile Panel or Profile Builder)
  useEffect(() => {
    const key = matchProgramKey(profile);
    setSelectedProgramKey(key);
    setSelectedConcentration(profile.concentration ?? "");
    setJobRole((profile.careerInterests ?? []).filter(Boolean).join(", "));
    setBackground(profile.previousDegree?.trim() ?? "");
    setCurrentSemester(profile.currentSemester?.trim() ?? "");
    setIsF1(profile.isF1Student ?? false);
    setProfileRefreshed(true);
    const t = setTimeout(() => setProfileRefreshed(false), 2200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.stevensProgram, profile.programName, profile.major, profile.concentration, profile.careerInterests?.join(","), profile.currentSemester, profile.isF1Student, profile.previousDegree]);

  const program: StevensProgram | undefined = useMemo(() => getProgram(selectedProgramKey), [selectedProgramKey]);

  const hasKey = (() => {
    const k = loadJson<{ keys: string[] }>(storageKeys.groqKeys, { keys: [] });
    return (k.keys ?? []).some((x) => x.trim().length > 0);
  })();

  const completedIds = useMemo(() => new Set<string>(profile.skills ?? []), [profile.skills]);

  const checkPrereqs = useCallback((course: StevensCourse): string | null => {
    const prereq = course.prerequisites.trim();
    if (!prereq || prereq === "None" || prereq === "Not specified" || prereq === "None specified") return null;
    return prereq;
  }, []);

  const generate = async () => {
    if (!program) return;
    setErr(null);
    setLoading(true);
    try {
      const eligibleCourses = program.courses.filter(
        (c) => !completedIds.has(c.id) && !rejected.has(c.id) && !accepted.has(c.id)
      );

      const userMsg = [
        `STUDENT PROFILE: ${JSON.stringify({
          name: profile.fullName,
          currentSemester,
          careerGoals: jobRole.split(/[,;]+/).map((s) => s.trim()).filter(Boolean),
          background,
          skillLevel: profile.gaps ?? "Intermediate",
          strengths: profile.strengths ?? "",
          completedCourses: [...completedIds],
          interests: (profile.tools ?? []).concat(profile.careerInterests ?? []),
          isF1,
          gpa: profile.gpa,
          degreeLevel: profile.degreeLevel
        })}`,
        `TARGET JOB ROLE(S): ${jobRole}`,
        `SELECTED PROGRAM: ${program.label} (${program.degree}) — ${program.totalCreditsRequired} total credits`,
        selectedConcentration ? `SELECTED CONCENTRATION: ${selectedConcentration}` : "",
        `DEGREE REQUIREMENTS (buckets):`,
        JSON.stringify(program.buckets.map((b) => ({
          key: b.key,
          label: b.label,
          minCredits: b.minCredits,
          minCourses: b.minCourses,
          allRequired: b.allRequired,
          notes: b.notes
        }))),
        `PROGRAM_COURSES (all available, with pool info):`,
        JSON.stringify(eligibleCourses.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          credits: c.credits,
          pool: c.poolKey,
          prerequisites: c.prerequisites,
          description: c.description.slice(0, 200)
        }))),
        `CURRENT_SEMESTER: ${currentSemester || "Fall 2026"}`,
        `ALREADY REJECTED: ${[...rejected].join(", ")}`,
                `TASK: Recommend a diverse list of 8–12 relevant courses for ${currentSemester || "Fall 2026"} ONLY. All "semester" fields must be "${currentSemester || "Fall 2026"}". ` +
        `Include all relevant Core courses first, then the best-matching Electives for their career goals.`
      ].filter(Boolean).join("\n\n");

      const raw = await chatJson(SYS_PROMPT, userMsg) as Partial<RecommendResult>;
      let recommended: RecommendedCourse[] = Array.isArray(raw.recommended)
        ? (raw.recommended as RecommendedCourse[]).filter(
            (r) => r.courseId && program.courses.some((c) => c.id === r.courseId)
          )
        : [];

            // Normalise: force all to current semester. We no longer clamp here so the user has many choices.
      const sem = currentSemester || "Fall 2026";
      recommended = recommended.map(r => ({ ...r, semester: sem }));

      setResult({
        recommended,
        skillGaps: Array.isArray(raw.skillGaps) ? raw.skillGaps as string[] : [],
        warnings: Array.isArray(raw.warnings) ? raw.warnings as string[] : []
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Live credit tracker for current semester
  const semCreditsAccepted = useMemo(() => {
    if (!program) return 0;
    return [...accepted].reduce((sum, id) => {
      const c = program.courses.find((x) => x.id === id);
      return sum + (c?.credits ?? 3);
    }, 0);
  }, [accepted, program]);

  const semCoursesAccepted = accepted.size;
  // Over limit → warn but never block
  const semOverIdeal = semCreditsAccepted > MAX_SEM_CREDITS || semCoursesAccepted > MAX_SEM_COURSES;
  const semFull = false; // Never hard-block — user can always accept more

  const byBucket = useMemo(() => {
    if (!result || !program) return [];
    const recMap = new Map(result.recommended.map((r) => [r.courseId, r]));
    return program.buckets.map((bucket) => {
      const recs = bucket.courseIds
        .filter((id) => recMap.has(id) && !rejected.has(id))
        .map((id) => recMap.get(id)!);
      return { bucket, recs };
    }).filter(({ recs }) => recs.length > 0);
  }, [result, program, rejected]);

  const bySemester = useMemo(() => {
    if (!result) return [];
    const groups: Record<string, RecommendedCourse[]> = {};
    for (const rec of result.recommended) {
      if (!groups[rec.semester]) groups[rec.semester] = [];
      groups[rec.semester].push(rec);
    }
    // Return entries, optionally sorted. Since we currently only recommend 
    // for one semester, this will usually be a single-item array.
    return Object.entries(groups);
  }, [result]);

  return (
    <div className="space-y-5">
      {/* Input panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Generate your course plan</h2>
            <p className="mt-0.5 text-xs text-slate-500">Pick 3–4 courses (9–12 credits) from the recommendations below to build your official plan.</p>
          </div>
          <AnimatePresence>
            {profileRefreshed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
              >
                <User className="h-3 w-3" />
                Profile synced
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile fields from Intelligent Profile */}
        {(profile.fullName || profile.programName || (profile.careerInterests ?? []).length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#0056D2]/15 bg-[#F2F7FF] px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0056D2]">From your profile</span>
            {profile.fullName && <span className="text-xs text-slate-700"><span className="font-medium">Name:</span> {profile.fullName}</span>}
            {profile.currentSemester && <span className="text-xs text-slate-700"><span className="font-medium">Semester:</span> {profile.currentSemester}</span>}
            {profile.gpa != null && <span className="text-xs text-slate-700"><span className="font-medium">GPA:</span> {profile.gpa}</span>}
            {profile.isF1Student && <span className="text-xs font-semibold text-[#0056D2]">F-1</span>}
            {profile.degreeLevel && <span className="text-xs text-slate-700">{profile.degreeLevel}</span>}
            {(profile.careerInterests ?? []).length > 0 && (
              <span className="text-xs text-slate-700">
                <span className="font-medium">Goals:</span> {(profile.careerInterests ?? []).join(", ")}
              </span>
            )}
          </div>
        )}

        {/* Row 1: Program + Concentration side by side */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Program</span>
            <select
              value={selectedProgramKey}
              onChange={(e) => {
                const key = e.target.value;
                const prog = ALL_PROGRAMS.find((p) => p.key === key);
                setSelectedProgramKey(key);
                setResult(null);
                setSelectedConcentration("");
                // Persist back to profile so it's remembered everywhere
                updateProfile({
                  stevensProgram: key || undefined,
                  programName: prog?.label ?? undefined,
                  major: prog?.degree ?? profile.major
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25"
            >
              <option value="">— Select program —</option>
              {PROGRAM_LABELS.map((p) => (
                <option key={p.key} value={p.key}>{p.degree} — {p.label}</option>
              ))}
            </select>
          </label>

          {(program?.concentrations?.length ?? 0) > 0 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Concentration</span>
              <select
                value={selectedConcentration}
                onChange={(e) => {
                  setSelectedConcentration(e.target.value);
                  updateProfile({ concentration: e.target.value || undefined });
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25"
              >
                <option value="">— Any / not decided —</option>
                {program!.concentrations!.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Current semester</span>
              <select
                value={currentSemester}
                onChange={(e) => { setCurrentSemester(e.target.value); updateProfile({ currentSemester: e.target.value }); }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
              >
                <option value="">— Select term —</option>
                <option>Spring 2026</option>
                <option>Summer 2026</option>
                <option>Fall 2026</option>
                <option>Spring 2027</option>
                <option>Summer 2027</option>
                <option>Fall 2027</option>
              </select>
            </label>
          )}
        </div>

        {/* Row 2: Job role + Background */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Target job role(s)</span>
            <input
              value={jobRole}
              onChange={(e) => {
                setJobRole(e.target.value);
                const interests = e.target.value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
                if (interests.length) updateProfile({ careerInterests: interests });
              }}
              placeholder="e.g. Data Scientist, ML Engineer"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Educational background</span>
            <input
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                updateProfile({ previousDegree: e.target.value || undefined });
              }}
              placeholder="e.g. B.E. Mechanical Engineering"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
            />
          </label>
        </div>

        {/* Row 3: F-1 toggle + current semester (if concentration shown in row 1) */}
        {(program?.concentrations?.length ?? 0) > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Current semester</span>
              <select
                value={currentSemester}
                onChange={(e) => { setCurrentSemester(e.target.value); updateProfile({ currentSemester: e.target.value }); }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
              >
                <option value="">— Select term —</option>
                <option>Spring 2026</option>
                <option>Summer 2026</option>
                <option>Fall 2026</option>
                <option>Spring 2027</option>
                <option>Summer 2027</option>
                <option>Fall 2027</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">International / F-1 student</div>
                <div className="text-xs text-slate-500">Affects credit-load warnings in My Plan</div>
              </div>
              <input type="checkbox" checked={isF1}
                onChange={(e) => { setIsF1(e.target.checked); updateProfile({ isF1Student: e.target.checked }); }}
                className="h-4 w-4 accent-[#0056D2]"
              />
            </label>
          </div>
        )}

        {/* Program info strip */}
        {program && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-600"><span className="font-semibold">Dept:</span> {program.department}</span>
            <span className="text-xs text-slate-600"><span className="font-semibold">Credits:</span> {program.totalCreditsRequired}</span>
            <span className="text-xs text-slate-600"><span className="font-semibold">Catalog:</span> {program.catalogYear}</span>
            {program.minimumGpa && (
              <span className="text-xs text-slate-600"><span className="font-semibold">Min GPA:</span> {program.minimumGpa}</span>
            )}
            <a href={program.url} target="_blank" rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline">
              Stevens catalog <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {hasKey ? (
            <Button type="button" onClick={generate} disabled={loading || !program} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {loading ? "Generating plan…" : "Generate my plan"}
            </Button>
          ) : (
            <a href="/app/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
              Configure Groq API key →
            </a>
          )}
          {result && (
            <Button type="button" variant="ghost" className="gap-1.5" onClick={() => setResult(null)}>
              <RefreshCw className="h-4 w-4" /> Clear results
            </Button>
          )}
        </div>
      </div>

      {err && <AiErrorBanner message={err} onDismiss={() => setErr(null)} />}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          ))}
        </div>
      )}

      {/* Live credit tracker — always visible once something is accepted */}
      {(result || semCoursesAccepted > 0) && (
        <div className={`rounded-2xl border p-4 ${semFull ? "border-emerald-300 bg-emerald-50" : "border-[#0056D2]/25 bg-[#F2F7FF]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {currentSemester || "Current semester"} — course load
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-slate-900">{semCreditsAccepted}</span>
                <span className="text-sm text-slate-500">/ {MAX_SEM_CREDITS} credits</span>
                <span className="text-sm text-slate-400">·</span>
                <span className="text-sm text-slate-500">{semCoursesAccepted} / {MAX_SEM_COURSES} courses</span>
              </div>
            </div>
            <div className="text-right">
              {semCreditsAccepted > MAX_SEM_CREDITS || semCoursesAccepted > MAX_SEM_COURSES ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> Limit reached — cannot add more
                </span>
              ) : semCreditsAccepted >= MIN_SEM_CREDITS ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ideal load reached
                </span>
              ) : (
                <span className="text-xs text-slate-600">
                  Need <span className="font-semibold">{Math.max(0, MIN_SEM_CREDITS - semCreditsAccepted)} more credits</span> for minimum load
                </span>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70">
            <motion.div
              className={`h-full rounded-full ${semCreditsAccepted > MAX_SEM_CREDITS ? "bg-red-500" : semCreditsAccepted >= MIN_SEM_CREDITS ? "bg-emerald-500" : "bg-[#0056D2]"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (semCreditsAccepted / MAX_SEM_CREDITS) * 100)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0</span>
            <span className="text-slate-600 font-medium">{MIN_SEM_CREDITS} min</span>
            <span className="font-medium text-slate-700">{MAX_SEM_CREDITS} max</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {result && !loading && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Skill gaps + warnings */}
            {(result.skillGaps.length > 0 || result.warnings.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {result.skillGaps.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800">Skill gaps identified</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.skillGaps.map((s) => (
                        <span key={s} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-red-800">Warnings</div>
                    <ul className="space-y-1">
                      {result.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-red-900">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Grouped by semester — current first, future below */}
            {bySemester.map(([sem, recs], si) => {
              const isCurrentSem = sem === (currentSemester || "Spring 2026");
              return (
                <div key={sem}>
                  {/* Semester header */}
                  <div className={`mb-3 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ${
                    isCurrentSem ? "border border-[#0056D2]/25 bg-[#F2F7FF]" : "border border-slate-200 bg-slate-50"
                  }`}>
                    <h3 className={`text-sm font-bold ${isCurrentSem ? "text-[#0056D2]" : "text-slate-600"}`}>{sem}</h3>
                    {isCurrentSem
                      ? <span className="rounded-full bg-[#0056D2] px-2 py-0.5 text-[10px] font-bold text-white">Current — enroll now</span>
                      : <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">Future — view only</span>}
                  </div>

                  <div className="space-y-3">
                    {recs.map((rec, i) => {
                      const course = program?.courses.find((c) => c.id === rec.courseId);
                      const isAccepted = accepted.has(rec.courseId);
                      const prereqNote = course ? checkPrereqs(course) : null;
                      const dtype = difficultyFromPool(course?.poolKey ?? "");
                      const isFuture = !isCurrentSem;

                      return (
                        <CourseCard
                          key={rec.courseId}
                          rec={rec}
                          course={course}
                          isAccepted={isAccepted}
                          isFuture={isFuture}
                          prereqNote={prereqNote}
                          dtype={dtype}
                          semOverIdeal={semOverIdeal}
                          animDelay={si * 0.06 + i * 0.05}
                          onAccept={() => onAccept(rec)}
                          onReject={() => onReject(rec.courseId)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Legacy: byBucket placeholder kept for zero-semester result edge case */}
            {bySemester.length === 0 && byBucket.map(({ bucket, recs }) => (
              <div key={bucket.key}>
                <div className="mb-3 flex flex-wrap items-baseline gap-3">
                  <h3 className="text-sm font-bold text-slate-900">{bucket.label}</h3>
                </div>
                <div className="space-y-3">
                  {recs.map((rec, i) => {
                    const course = program?.courses.find((c) => c.id === rec.courseId);
                    const isAccepted = accepted.has(rec.courseId);
                    const prereqNote = course ? checkPrereqs(course) : null;
                    const dtype = difficultyFromPool(course?.poolKey ?? "");
                    return (
                      <CourseCard key={rec.courseId} rec={rec} course={course} isAccepted={isAccepted}
                        isFuture={false} prereqNote={prereqNote} dtype={dtype} semOverIdeal={semOverIdeal}
                        animDelay={i * 0.05} onAccept={() => onAccept(rec)} onReject={() => onReject(rec.courseId)} />
                    );
                  })}
                </div>
              </div>
            ))}

            {bySemester.length === 0 && byBucket.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                No courses recommended. Try changing your job role or program selection.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Rich expandable course card ─────────────────────────────────────────────

type CourseCardProps = {
  rec: RecommendedCourse;
  course: StevensCourse | undefined;
  isAccepted: boolean;
  isFuture: boolean;
  prereqNote: string | null;
  dtype: string;
  semOverIdeal: boolean;
  animDelay: number;
  onAccept: () => void;
  onReject: () => void;
};

function CourseCard({ rec, course, isAccepted, isFuture, prereqNote, dtype, semOverIdeal, animDelay, onAccept, onReject }: CourseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animDelay, duration: 0.28 }}
      className={`rounded-2xl border transition ${
        isAccepted ? "border-emerald-300 bg-emerald-50"
          : isFuture ? "border-slate-200 bg-slate-50/80 opacity-85"
            : "border-slate-200 bg-white"
      }`}
    >
      {/* ── Card header (always visible) ── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{course?.code ?? rec.courseId}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${difficultyColor(dtype)}`}>{dtype}</span>
            </div>
            <div className="mt-0.5 text-sm font-bold leading-snug text-slate-900">{course?.name ?? rec.courseId}</div>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
            <BookOpen className="h-2.5 w-2.5" />{course?.credits ?? 3} credits
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
            <Clock className="h-2.5 w-2.5" />{rec.semester}
          </span>
          {course?.department && (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">{course.department}</span>
          )}
          {course?.typicallyOffered && course.typicallyOffered !== "Not specified" && (
            <span className="rounded-full border border-[#0056D2]/20 bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-medium text-[#0056D2]">
              {course.typicallyOffered.split(",")[0]?.trim()}
            </span>
          )}
        </div>

        {/* Prereq warning */}
        {prereqNote && prereqNote !== "None specified" && (
          <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div><span className="font-semibold">Prerequisite: </span>{prereqNote}</div>
          </div>
        )}

        {/* AI reason */}
        <div className="mt-2 rounded-xl border border-[#0056D2]/15 bg-[#F2F7FF]/60 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#0056D2] mb-0.5">Why STEVE recommends this</div>
          <p className="text-xs leading-relaxed text-slate-700">{rec.reason}</p>
        </div>

        {/* Expand / collapse */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Hide details</> : <><ChevronDown className="h-3.5 w-3.5" /> View full details</>}
        </button>
      </div>

      {/* ── Expanded detail section ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="space-y-3 p-4">
              {/* Full description */}
              {course?.description && (
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Course description</div>
                  <p className="text-xs leading-relaxed text-slate-700">{course.description}</p>
                </div>
              )}

              {/* Skills you'll gain */}
              {course?.skills && course.skills.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Tag className="h-3 w-3" /> Skills you'll gain
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {course.skills.map((s) => (
                      <span key={s} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics / tags */}
              {course?.tags && course.tags.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Topics</div>
                  <div className="flex flex-wrap gap-1.5">
                    {course.tags.map((t) => (
                      <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full prereqs */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Prerequisites</div>
                  <p className="text-slate-700">{course?.prerequisites ?? "None"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Typically offered</div>
                  <p className="text-slate-700">{course?.typicallyOffered && course.typicallyOffered !== "Not specified" ? course.typicallyOffered : "Check Stevens catalog"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Department</div>
                <p className="text-slate-700">{course?.department ?? "—"}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action buttons ── */}
      <div className="flex gap-2 border-t border-slate-100 p-3">
        {isFuture ? (
          <span className="flex-1 cursor-not-allowed rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-400">
            Enroll in {rec.semester}
          </span>
        ) : isAccepted ? (
          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
          </span>
        ) : (
          <>
            <button type="button" onClick={onAccept}
              className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                semOverIdeal
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}>
              {semOverIdeal ? `+${course?.credits ?? 3} cr (over limit)` : `Accept +${course?.credits ?? 3} cr`}
            </button>
            <button type="button" onClick={onReject}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-700">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
