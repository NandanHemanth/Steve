import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap, RefreshCw, Trash2, LayoutList, Calendar, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { ALL_PROGRAMS, getProgram } from "../../data/stevensData";
import type { RecommendedCourse } from "./SmartRecommender";
import type { StudentProfile } from "../../lib/types";

type Props = {
  plan: RecommendedCourse[];
  profile: StudentProfile;
  onRemove: (courseId: string) => void;
  onRegenerate: () => void;
  programKey?: string;
};

const TERMS = ["Fall 2026", "Spring 2027", "Summer 2027", "Fall 2027", "Spring 2028", "Summer 2028"];
const F1_MIN = 9;
const IDEAL_MIN = 9;
const IDEAL_MAX = 12;
const WARN_MAX = 12;

function resolveProgramKey(profile: StudentProfile, hint?: string): string {
  if (hint) return hint;
  if (profile.programName) {
    const m = ALL_PROGRAMS.find((p) => p.label.toLowerCase().includes(profile.programName!.toLowerCase()));
    if (m) return m.key;
  }
  return ALL_PROGRAMS[0]?.key ?? "";
}

function semesterBg(credits: number, isF1: boolean) {
  if (credits > WARN_MAX) return "border-red-200 bg-red-50/50";
  if (isF1 && credits > 0 && credits < F1_MIN) return "border-red-200 bg-red-50/50";
  if (credits >= IDEAL_MIN && credits <= IDEAL_MAX) return "border-emerald-200 bg-emerald-50/50";
  if (credits > 0) return "border-amber-200 bg-amber-50/50";
  return "border-slate-200 bg-white";
}

export function MyCoursePlan({ plan, profile, onRemove, onRegenerate, programKey }: Props) {
  const [semOverrides, setSemOverrides] = useState<Record<string, string>>({});

  const key = resolveProgramKey(profile, programKey);
  const program = getProgram(key);

  const effectivePlan = plan.map((r) => ({
    ...r,
    semester: semOverrides[r.courseId] ?? r.semester
  }));

  const allSemesters = Array.from(
    new Set([...TERMS, ...effectivePlan.map((r) => r.semester)])
  ).sort();

  const creditsForSem = (sem: string) =>
    effectivePlan.filter((r) => r.semester === sem).reduce((sum, r) => {
      const c = program?.courses.find((x) => x.id === r.courseId);
      return sum + (c?.credits ?? 3);
    }, 0);

  const totalPlanCredits = effectivePlan.reduce((sum, r) => {
    const c = program?.courses.find((x) => x.id === r.courseId);
    return sum + (c?.credits ?? 3);
  }, 0);

  const totalReq = program?.totalCreditsRequired ?? 30;

  if (plan.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <LayoutList className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mt-6 text-lg font-bold text-slate-900">Your plan is empty</h3>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          Explore recommended courses and add them to your plan to see your academic roadmap.
        </p>
        <Button type="button" className="mt-8 gap-2 px-6" onClick={onRegenerate}>
          <RefreshCw className="h-4 w-4" /> Go to Recommender
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header Stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Degree Progress</div>
            <GraduationCap className="h-5 w-5 text-[#0056D2]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{totalPlanCredits}</span>
            <span className="text-sm font-medium text-slate-500">/ {totalReq} credits</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-[#0056D2]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalPlanCredits / totalReq) * 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Courses</div>
            <BookOpen className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{plan.length}</span>
            <span className="text-sm font-medium text-slate-500">planned courses</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Across {allSemesters.filter(s => effectivePlan.some(p => p.semester === s)).length} terms
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1"
        >
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Dept</div>
            <div className="mt-1.5 text-sm font-bold text-slate-900">{program?.label ?? "Multiple Programs"}</div>
            <div className="mt-0.5 text-xs text-slate-500">{program?.degree ?? "Masters"} Degree Plan</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRegenerate} className="h-10 w-10 rounded-full p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* ── Policies Bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#0056D2]/10 bg-[#F2F7FF] px-4 py-3">
        <Clock className="h-4 w-4 text-[#0056D2]" />
        <span className="text-xs font-semibold text-[#0056D2]">Stevens Load Policy:</span>
        <span className="text-xs text-slate-700 font-medium">9–12 credits / 3–4 courses per term</span>
        <div className="h-1 w-1 rounded-full bg-slate-300 mx-1" />
        {profile.isF1Student && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> F-1 Visa: Min 9 cr required
          </span>
        )}
      </div>

      {/* ── Semester Timeline ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence>
          {allSemesters.map((sem, si) => {
            const semCourses = effectivePlan.filter((r) => r.semester === sem);
            const credits = creditsForSem(sem);
            const f1Warn = profile.isF1Student && semCourses.length > 0 && credits < F1_MIN;
            const overload = credits > WARN_MAX;
            const hasCourses = semCourses.length > 0;

            return (
              <motion.div
                key={sem}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.05 }}
                className={`flex flex-col rounded-3xl border transition-all duration-300 ${
                  hasCourses ? `${semesterBg(credits, profile.isF1Student)} shadow-sm` : "border-slate-100 bg-slate-50/30 opacity-60"
                }`}
              >
                {/* Semester Header */}
                <div className="border-b border-inherit p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{sem}</span>
                    </div>
                    {hasCourses && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Load</span>
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black tabular-nums shadow-sm ${
                          overload || f1Warn ? "bg-red-500 text-white" : "bg-[#0056D2] text-white"
                        }`}>
                          {credits} CR
                        </span>
                      </div>
                    )}
                  </div>

                  {(f1Warn || overload || semCourses.length > 4) && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-100/80 px-2.5 py-1.5 text-[10px] font-bold text-red-700 ring-1 ring-red-200">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>{overload ? "Over 12 cr limit" : semCourses.length > 4 ? "Over 4 course limit" : "Below 9 cr (F-1)"}</span>
                    </div>
                  )}
                </div>

                {/* Courses List */}
                <div className="flex-1 space-y-2 p-3">
                  {semCourses.map((r) => {
                    const course = program?.courses.find((c) => c.id === r.courseId);
                    return (
                      <motion.div 
                        key={r.courseId} 
                        layout
                        className="group relative rounded-2xl border border-white bg-white/80 p-3 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-slate-400">{course?.code ?? r.courseId}</div>
                            <div className="mt-0.5 truncate text-xs font-bold text-slate-900">{course?.name ?? r.courseId}</div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-slate-500">
                              <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{course?.credits ?? 3} cr</span>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span className="truncate">{r.category}</span>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => onRemove(r.courseId)}
                            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 lg:opacity-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        
                        <div className="mt-3">
                          <select
                            value={semOverrides[r.courseId] ?? r.semester}
                            onChange={(e) => setSemOverrides((p) => ({ ...p, [r.courseId]: e.target.value }))}
                            className="w-full cursor-pointer rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 outline-none transition hover:border-slate-200"
                          >
                            {TERMS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </motion.div>
                    );
                  })}

                  {semCourses.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center py-8 opacity-40">
                      <div className="rounded-full bg-slate-200 p-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                      </div>
                      <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Open Slot</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
