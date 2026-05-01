import { useMemo } from "react";
import { CheckCircle2, Circle, ExternalLink, PlusCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getProgram, type RequirementBucket, type StevensCourse } from "../../data/stevensData";
import type { RecommendedCourse } from "./SmartRecommender";
import type { StudentProfile } from "../../lib/types";
import { ALL_PROGRAMS } from "../../data/stevensData";

type Props = {
  plan: RecommendedCourse[];
  profile: StudentProfile;
  onAddToPlan: (courseId: string) => void;
  programKey?: string;
};

function ProgressRing({ pct, size = 100 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#0056D2";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={10} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize={17} fontWeight={700} fill="#0f172a">
        {pct}%
      </text>
    </svg>
  );
}

function BucketRow({
  bucket, completedIds, plannedIds, program, onAddToPlan
}: {
  bucket: RequirementBucket;
  completedIds: Set<string>;
  plannedIds: Set<string>;
  program: ReturnType<typeof getProgram>;
  onAddToPlan: (id: string) => void;
}) {
  const bucketDoneIds = bucket.courseIds.filter((id) => completedIds.has(id));
  const bucketPlanIds = bucket.courseIds.filter((id) => plannedIds.has(id) && !completedIds.has(id));
  const earnedCr = [...bucketDoneIds, ...bucketPlanIds].reduce((s, id) => {
    const c = program?.courses.find((x) => x.id === id);
    return s + (c?.credits ?? 3);
  }, 0);

  const metCr = earnedCr >= bucket.minCredits;
  const countOk = bucket.minCourses == null || bucketDoneIds.length + bucketPlanIds.length >= bucket.minCourses;
  const allMet = metCr && countOk;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {allMet
            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            : <Circle className="h-4 w-4 text-slate-400" />
          }
          <span className="text-sm font-bold text-slate-900">{bucket.label}</span>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${allMet ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          {earnedCr} / {bucket.minCredits} cr
          {bucket.minCourses ? ` · ${bucketDoneIds.length + bucketPlanIds.length}/${bucket.minCourses} courses` : ""}
        </span>
      </div>

      {bucket.notes && <p className="mt-1 text-xs text-slate-500">{bucket.notes}</p>}

      <div className="mt-3 space-y-1.5">
        {bucket.courseIds.map((id) => {
          const course = program?.courses.find((c) => c.id === id);
          const done = completedIds.has(id);
          const inPlan = plannedIds.has(id);
          const missing = !done && !inPlan;
          return (
            <div
              key={id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                done ? "border-emerald-200 bg-emerald-50"
                  : inPlan ? "border-[#0056D2]/20 bg-[#F2F7FF]"
                    : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  : inPlan ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0056D2]" />
                    : <XCircle className="h-4 w-4 shrink-0 text-slate-300" />}
                <span className="truncate">
                  <span className="mr-1.5 text-xs font-bold text-slate-500">{course?.code ?? id}</span>
                  <span className={done ? "text-emerald-900" : inPlan ? "text-slate-800" : "text-slate-500"}>
                    {course?.name ?? id}
                  </span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-slate-500">{course?.credits ?? 3} cr</span>
                {done && <span className="text-[11px] font-bold text-emerald-700">Done</span>}
                {inPlan && !done && <span className="text-[11px] font-bold text-[#0056D2]">In plan</span>}
                {missing && (
                  <button
                    type="button"
                    onClick={() => onAddToPlan(id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#0056D2]/30 bg-[#F2F7FF] px-2 py-0.5 text-[11px] font-bold text-[#0056D2] hover:bg-[#0056D2] hover:text-white transition"
                  >
                    <PlusCircle className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function RequirementValidator({ plan, profile, onAddToPlan, programKey }: Props) {
  // Auto-detect program from plan or profile
  const resolvedKey = useMemo(() => {
    if (programKey) return programKey;
    if (profile.programName) {
      const match = ALL_PROGRAMS.find((p) =>
        p.label.toLowerCase().includes(profile.programName!.toLowerCase())
      );
      if (match) return match.key;
    }
    return ALL_PROGRAMS[0]?.key ?? "";
  }, [programKey, profile.programName]);

  const program = useMemo(() => getProgram(resolvedKey), [resolvedKey]);

  const completedIds = useMemo(() => new Set<string>(profile.skills ?? []), [profile.skills]);
  const plannedIds = useMemo(() => new Set<string>(plan.map((r) => r.courseId)), [plan]);

  const totalCreditsNeeded = program?.totalCreditsRequired ?? 30;
  const f1MinPerTerm = 9;

  const completedCredits = useMemo(() => [...completedIds].reduce((s, id) => {
    const c = program?.courses.find((x) => x.id === id);
    return s + (c?.credits ?? 3);
  }, 0), [completedIds, program]);

  const plannedCredits = useMemo(() => [...plannedIds].reduce((s, id) => {
    if (completedIds.has(id)) return s;
    const c = program?.courses.find((x) => x.id === id);
    return s + (c?.credits ?? 3);
  }, 0), [plannedIds, completedIds, program]);

  const totalCredits = completedCredits + plannedCredits;
  const overallPct = Math.min(100, Math.round((totalCredits / totalCreditsNeeded) * 100));

  if (!program) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
        No program selected. Choose a program in the Smart Recommender tab first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-8 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <ProgressRing pct={overallPct} size={108} />
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">{program.label}</h2>
          <div className="text-xl font-bold tabular-nums text-slate-900">
            {totalCredits} <span className="text-sm font-normal text-slate-500">/ {totalCreditsNeeded} credits</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />{completedCredits} completed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0056D2]" />{plannedCredits} in plan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />{Math.max(0, totalCreditsNeeded - totalCredits)} remaining
            </span>
          </div>
          {program.minimumGpa && (
            <div className="text-xs text-slate-500">Minimum GPA: <span className="font-semibold text-slate-800">{program.minimumGpa}</span></div>
          )}
          {profile.isF1Student && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0056D2]/25 bg-[#F2F7FF] px-3 py-1 text-xs font-semibold text-[#0056D2]">
              F-1: minimum {f1MinPerTerm} credits/term — verify per semester in My Plan
            </div>
          )}
          <a href={program.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline">
            View Stevens catalog <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </motion.div>

      {/* Requirement buckets */}
      <div className="space-y-3">
        {program.buckets.map((bucket) => (
          <BucketRow
            key={bucket.key}
            bucket={bucket}
            completedIds={completedIds}
            plannedIds={plannedIds}
            program={program}
            onAddToPlan={onAddToPlan}
          />
        ))}
      </div>
    </div>
  );
}
