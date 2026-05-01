import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Clock, Headphones, Layers, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import type { TutorModule } from "../lib/tutor/types";
import { deleteCourse, getCourse, patchCourse } from "../lib/tutor/repo";
import { lessonProgress, lessonsDueToday, streakDays } from "../lib/tutor/analytics";
import { renewChunkDeadline, rebuildSchedule } from "../lib/tutor/schedulePlans";

export function CourseOverviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [rev, setRev] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [renewing, setRenewing] = useState<string | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const nav = useNavigate();

  const bump = () => setRev((v) => v + 1);
  const course = useMemo(() => (courseId ? getCourse(courseId) : undefined), [courseId, rev]);

  if (!courseId || !course) {
    return (
      <div className="text-sm text-slate-600">
        Missing course.{" "}
        <Link className="text-[#0056D2] underline" to="/app/dashboard">
          Back
        </Link>
      </div>
    );
  }

  const p = lessonProgress(course);
  const streak = streakDays(course);
  const due = lessonsDueToday(course);

  function toggle(mid: string) {
    setOpen((o) => ({ ...o, [mid]: !o[mid] }));
  }

  const firstLessonId = course.modules.flatMap((m) => m.lessons).find((l) => !l.completedAtISO)?.id;

  return (
    <div>
      <div className="text-sm text-slate-600">
        <Link className="text-[#0056D2] underline" to="/app/dashboard">
          Dashboard
        </Link>
        {" / "}
        {course.title}
      </div>

      <header className="mt-4 flex flex-col gap-3 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{course.title}</h1>
          {course.subtitle ? <p className="mt-2 text-base text-slate-600">{course.subtitle}</p> : null}
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <Sparkles className="h-4 w-4 text-[#0056D2]" aria-hidden />
            Personalized for <span className="font-semibold">{course.difficultyBand}</span> pacing · streak {streak} day
            {streak === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={firstLessonId ? `/app/courses/${course.id}/learn?lesson=${firstLessonId}` : `/app/courses/${course.id}/learn`}
            className="rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A5BD8]"
          >
            Resume learning
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="border border-slate-200 bg-white"
            onClick={() => {
              patchCourse(course.id, (c) => rebuildSchedule(c));
              bump();
            }}
          >
            Rebuild timetable
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="border border-red-200 bg-white text-red-700 hover:bg-red-50"
            onClick={() => setShowDelete(true)}
          >
            Unenroll / delete
          </Button>
        </div>
      </header>

      <section className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5">
        {[
          [`${course.modules.length}`, "Modules"],
          [`${course.weeksTotal} weeks`, "Target runway"],
          [`${course.hoursPerWeek} h/wk`, "Study load"],
          [`${p.pct}%`, "Complete"],
          [`${due.overdueChunks.length}`, "Bundles needing slack"]
        ].map(([label, hint]) => (
          <div key={hint as string} className="rounded-2xl border border-slate-100 bg-[#fafbfc] px-4 py-3">
            <div className="text-lg font-semibold tabular-nums text-slate-900">{label}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{hint}</div>
          </div>
        ))}
      </section>

      {(due.overdueChunks.length || due.todayChunk?.lessonIds.some((id) => !lessonDone(course, id))) && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {due.overdueChunks.length ? (
            <span>
              Some study bundles slipped past their deadline — extend timelines like Coursera’s refresh workflow with{" "}
              <span className="font-semibold">Renew deadline</span> below.
            </span>
          ) : (
            <span>You have checkpoints scheduled today — dive in whenever you&apos;re ready.</span>
          )}
        </div>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.85fr)]">
        <div>
          <nav className="flex gap-4 border-b border-slate-200 text-sm font-semibold text-slate-500">
            <span className="border-b-2 border-[#0056D2] pb-3 text-[#0047a8]">About</span>
            <span className="pb-3 hover:text-slate-800">
              Modules <span className="text-xs font-normal text-slate-500">(outline)</span>
            </span>
          </nav>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">What you&apos;ll learn</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(course.outcomes.length ? course.outcomes : ["Contextual lessons generated from your materials."]).map((o, i) => (
              <div key={i} className="flex gap-2 text-sm text-slate-800">
                <span className="mt-0.5 text-[#0056D2]">✓</span>
                {o}
              </div>
            ))}
          </div>
          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Skills & tools</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...course.skillsTags, ...course.toolsTags].length ? (
              [...course.skillsTags, ...course.toolsTags].map((t) => (
                <span key={t} className="rounded-full bg-[#F2F7FF] px-3 py-1 text-xs font-medium text-[#0047a8]">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-600">Tags appear after generation.</span>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Today&apos;s goals</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <input type="checkbox" readOnly checked={p.done > 0} className="mt-0.5" />
                Complete {Math.min(3, Math.max(1, due.todayChunk?.lessonIds.length ?? 1))} learning items from your plan
              </li>
              <li className="flex gap-2">
                <input type="checkbox" readOnly checked={p.pct > 0} className="mt-0.5" />
                Log progress in at least one interactive activity
              </li>
              <li className="flex gap-2">
                <input type="checkbox" readOnly checked={streak > 0} className="mt-0.5" />
                Keep your streak alive ({streak} days)
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-[#0056D2]" aria-hidden />
              Learning plan & deadlines
            </div>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs text-slate-700">
              {course.scheduleChunks.slice(0, 14).map((ch) => (
                <li key={ch.id} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">Day {ch.index + 1}</span>
                    <span className="text-slate-500">{ch.dateISO}</span>
                  </div>
                  <div className="text-slate-600">
                    Due{" "}
                    {new Date(ch.deadlineISO).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}{" "}
                    (end of day)
                  </div>
                  <button
                    type="button"
                    className="text-left text-[11px] font-semibold text-[#0056D2] underline"
                    onClick={() => {
                      setRenewing(ch.id);
                      setShowRenewModal(true);
                    }}
                  >
                    Renew deadline (+7 days)
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Layers className="h-5 w-5 text-[#0056D2]" aria-hidden />
          Syllabus modules
        </h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
          {course.modules.map((m) => (
            <ModuleRow key={m.id} mod={m} open={open[m.id]} onToggle={() => toggle(m.id)} courseId={course.id} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">PDF page guide</h2>
          <Button type="button" variant="ghost" className="border border-slate-200 bg-white" onClick={() => setShowPages((v) => !v)}>
            {showPages ? "Hide" : "Show"}
          </Button>
        </div>
        {showPages ? (
          <div className="mt-4 space-y-3">
            {(course.pageGuide ?? []).length ? (
              course.pageGuide!.map((p) => (
                <div key={p.page} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page {p.page}</div>
                      <div className="mt-1 text-base font-semibold text-slate-900">{p.title}</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        if (!window.speechSynthesis) return;
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(`${p.title}. ${p.summary}. ${p.keyPoints.join(". ")}`);
                        u.rate = 0.98;
                        window.speechSynthesis.speak(u);
                      }}
                    >
                      <Headphones className="h-4 w-4" aria-hidden />
                      Listen
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{p.summary}</p>
                  {p.keyPoints?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
                      {p.keyPoints.slice(0, 10).map((k, i) => (
                        <li key={i}>{k}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-700">
                No page guide found for this course yet. Create a new course from a PDF upload so we can generate page-by-page explanations.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {showRenewModal && renewing ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Renew this study deadline?</div>
            <p className="mt-2 text-sm text-slate-600">
              We&apos;ll nudge this study bundle forward by one week so you can keep momentum without losing your history.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  patchCourse(course.id, (c) => renewChunkDeadline(c, renewing, 7));
                  setShowRenewModal(false);
                  setRenewing(null);
                  bump();
                }}
              >
                Apply +7 days
              </Button>
              <Button type="button" variant="ghost" className="border border-slate-200 bg-white" onClick={() => setShowRenewModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showDelete ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">Delete this course?</div>
            <p className="mt-2 text-sm text-slate-600">
              This removes the course and progress from this browser. This can’t be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" className="border border-slate-200 bg-white" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  deleteCourse(course.id);
                  setShowDelete(false);
                  nav("/app/dashboard");
                }}
              >
                Delete course
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function lessonDone(course: ReturnType<typeof getCourse>, id: string) {
  if (!course) return false;
  for (const m of course.modules) {
    const l = m.lessons.find((x) => x.id === id);
    if (l) return Boolean(l.completedAtISO);
  }
  return false;
}

function ModuleRow(props: { mod: TutorModule; open: boolean; onToggle: () => void; courseId: string }) {
  const { mod, open, onToggle, courseId } = props;
  return (
    <div>
      <button type="button" className="flex w-full items-center gap-3 px-4 py-4 text-left" onClick={onToggle}>
        {open ? <ChevronDown className="h-4 w-4 text-[#0056D2]" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{mod.title}</div>
          <div className="text-xs text-slate-500">
            Module · {mod.hoursToComplete} hours est. · {mod.lessons.length} activities
          </div>
        </div>
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-[#fafbfc] px-6 py-3">
          <p className="text-sm text-slate-700">{mod.summary}</p>
          <ul className="mt-3 space-y-2">
            {mod.lessons.map((l) => (
              <li key={l.id}>
                <Link
                  className="text-sm font-medium text-[#0056D2] hover:underline"
                  to={`/app/courses/${courseId}/learn?lesson=${l.id}`}
                >
                  {l.title}
                </Link>
                <span className="ml-2 text-xs text-slate-500">
                  {l.kind.replace("_", " ")} · {l.minutesEstimate} min {l.completedAtISO ? "· done" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
