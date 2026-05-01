import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, BarChart3, BookOpen,
  CalendarClock, Clock3, Flame, Layers, Plus,
  Target, TrendingUp
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { profileCareersLabel } from "../lib/studentProfile";
import { useProfile } from "../lib/useProfile";
import type { TutorCourse } from "../lib/tutor/types";
import { deleteCourse, loadCourses } from "../lib/tutor/repo";
import { lessonProgress, lessonsDueToday, streakDays, totalsAcrossCourses } from "../lib/tutor/analytics";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.25, 0.1, 0.25, 1] }
});

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } }
};

const cardVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

function StatCard({
  label, value, hint, accent = false, icon: Icon
}: {
  label: string; value: string; hint?: string; accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      variants={cardVariant}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        accent
          ? "border-[#0056D2]/20 bg-[#0056D2] text-white"
          : "border-slate-200 bg-white"
      }`}
    >
      {accent && (
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-blue-200" : "text-slate-500"}`}>{label}</div>
          <div className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ? "text-white" : "text-slate-900"}`}>{value}</div>
          {hint && <div className={`mt-1 text-[11px] ${accent ? "text-blue-200" : "text-slate-500"}`}>{hint}</div>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-white/20" : "bg-[#F2F7FF]"}`}>
            <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-[#0056D2]"}`} aria-hidden />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const location = useLocation();
  const [rev, setRev] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { profile } = useProfile();
  const careerLine = useMemo(() => profileCareersLabel(profile), [profile]);
  const courses = useMemo(() => loadCourses(), [location.pathname, location.key, rev]);

  const totals = totalsAcrossCourses(courses);
  const activeStreakBest = useMemo(
    () => (courses.length ? Math.max(...courses.map((c) => streakDays(c)), 0) : 0),
    [courses]
  );
  const overdueAll = useMemo(
    () => courses.reduce((sum, c) => sum + lessonsDueToday(c).overdueChunks.length, 0),
    [courses]
  );

  const greetingHour = new Date().getHours();
  const greet = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.fullName?.trim() ? profile.fullName.split(" ")[0] : null;

  return (
    <div>
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dashboard</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {greet}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          {careerLine ? (
            <p className="mt-1 text-sm text-slate-600">
              Career focus: <span className="font-semibold text-slate-800">{careerLine}</span>
              {" · "}
              <Link to="/app/profile" className="text-[#0056D2] hover:underline">Edit</Link>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              <Link to="/app/profile" className="font-semibold text-[#0056D2] hover:underline">Add career interests →</Link>
              {" "}to personalize STEVE's recommendations.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/courses/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0A5BD8]"
          >
            <Plus className="h-4 w-4" />
            New AI course
          </Link>
          <Link
            to="/app/academic"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Course Planner
          </Link>
        </div>
      </motion.div>

      {/* Overdue alert */}
      {overdueAll ? (
        <motion.div {...fadeUp(0.1)} className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <span className="font-semibold">{overdueAll} study bundle{overdueAll === 1 ? "" : "s"}</span> past deadline — open a course and tap <span className="font-semibold">Renew deadline</span>.
          </span>
        </motion.div>
      ) : null}

      {/* Stat cards */}
      <motion.div
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <StatCard label="Active courses" value={String(totals.courses)} hint="Generated pathways" icon={BookOpen} accent />
        <StatCard label="Avg. completion" value={`${totals.avgPct}%`} hint="Across all tracks" icon={TrendingUp} />
        <StatCard label="Lessons done" value={`${totals.lessonsDone}/${totals.lessonsTotal || "—"}`} hint="All courses" icon={Layers} />
        <StatCard label="Learning time" value={`${Math.round(totals.minutesLearned / 6) / 10} h`} hint="Completed activities" icon={Clock3} />
      </motion.div>

      <motion.div
        className="mt-3 grid gap-3 sm:grid-cols-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <StatCard label="Best streak" value={`${activeStreakBest} days`} hint="Consecutive study" icon={Flame} />
        <StatCard label="Overdue bundles" value={String(overdueAll)} hint="Renew anytime" icon={CalendarClock} />
        <StatCard label="Difficulty" value={courses[0]?.difficultyBand ?? "—"} hint="Latest course" icon={Target} />
      </motion.div>

      {/* Analytics strip */}
      <motion.div {...fadeUp(0.25)} className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
          <BarChart3 className="h-4 w-4 text-[#0056D2]" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">Learning analytics</span>
        </div>
        <div className="grid divide-x divide-slate-200 sm:grid-cols-4">
          {[
            { label: "Completion rate", val: `${totals.avgPct}%`, sub: "avg across courses" },
            { label: "Library", val: String(totals.courses), sub: "AI-generated courses" },
            { label: "Momentum", val: totals.lessonsDone > 0 ? "On track" : "Get started", sub: "lesson activity" },
            { label: "Depth", val: totals.minutesLearned > 120 ? "Deep work" : "Building", sub: "engagement level" }
          ].map((x, i) => (
            <motion.div
              key={x.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className="px-5 py-4"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.label}</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{x.val}</div>
              <div className="text-[11px] text-slate-500">{x.sub}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Course list */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Your Chapters</h2>
          <Link to="/app/courses/new" className="inline-flex items-center gap-1 text-sm font-semibold text-[#0056D2] hover:underline">
            Generate another <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {courses.length === 0 ? (
          <motion.div {...fadeUp(0.15)} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Layers className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-800">No AI courses yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Upload a syllabus or paste learning objectives — STEVE drafts modules, pacing, flashcards, quizzes, and a capstone.
            </p>
            <Link
              to="/app/courses/new"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0056D2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0A5BD8]"
            >
              Create your first pathway
            </Link>
          </motion.div>
        ) : (
          <motion.div
            className="mt-4 grid gap-4 md:grid-cols-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {courses
              .slice()
              .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
              .map((c) => (
                <CourseCard key={c.id} course={c} onDelete={() => setDeleteId(c.id)} />
              ))}
          </motion.div>
        )}
      </section>

      {/* Delete modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="text-lg font-bold text-slate-900">Delete this course?</div>
              <p className="mt-2 text-sm text-slate-600">This removes the course and all progress. This cannot be undone.</p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => { deleteCourse(deleteId); setDeleteId(null); setRev((v) => v + 1); }}
                >
                  Delete course
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CourseCard({ course, onDelete }: { course: TutorCourse; onDelete: () => void }) {
  const p = lessonProgress(course);
  const due = lessonsDueToday(course);
  const streak = streakDays(course);

  return (
    <motion.div
      variants={cardVariant}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-[#0056D2]/30"
    >
      {/* Colored top stripe by difficulty */}
      <div className={`h-1.5 w-full ${course.difficultyBand === "advanced" ? "bg-red-500" : course.difficultyBand === "intermediate" ? "bg-amber-400" : "bg-emerald-500"}`} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/app/courses/${course.id}`} className="line-clamp-2 text-base font-bold text-slate-900 hover:text-[#0056D2]">
              {course.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <span>{course.subject}</span>
              <span>·</span>
              <span>{course.weeksTotal}wk</span>
              <span>·</span>
              <span>{course.hoursPerWeek}h/wk</span>
              <span>·</span>
              <span className="capitalize">{course.difficultyBand}</span>
            </div>
          </div>
          <div className={`shrink-0 rounded-xl px-2.5 py-1 text-sm font-bold tabular-nums ${p.pct >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-[#F2F7FF] text-[#0056D2]"}`}>
            {p.pct}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 overflow-hidden rounded-full bg-slate-100 h-2">
          <motion.div
            className="h-full rounded-full bg-[#0056D2]"
            initial={{ width: 0 }}
            animate={{ width: `${p.pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {p.done}/{p.total} lessons</span>
          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {due.overdueChunks.length} overdue</span>
          <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-orange-400" /> {streak}d streak</span>
          <span className="inline-flex items-center gap-1"><Target className="h-3.5 w-3.5" /> {due.todayChunk ? "Due today" : "On schedule"}</span>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Link
            to={`/app/courses/${course.id}/learn`}
            className="rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0A5BD8]"
          >
            Resume
          </Link>
          <Link
            to={`/app/courses/${course.id}`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Overview
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Unenroll
          </button>
        </div>
      </div>
    </motion.div>
  );
}
