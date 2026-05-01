import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import type { PlannedCourse, PlannedDeadline } from "../lib/academic/types";
import { loadPlanner, savePlanner, totalPlannerCredits } from "../lib/academic/plannerRepo";

export function CoursePlannerPage() {
  const initial = useMemo(() => loadPlanner(), []);
  const [courses, setCourses] = useState<PlannedCourse[]>(initial.courses);

  const persist = (next: PlannedCourse[]) => {
    setCourses(next);
    savePlanner({ courses: next });
  };

  const addCourse = () => {
    persist([
      ...courses,
      {
        id: crypto.randomUUID(),
        term: "Spring 2026",
        courseCode: "",
        title: "",
        credits: 3,
        deadlines: []
      }
    ]);
  };

  const updateCourse = (id: string, patch: Partial<PlannedCourse>) => {
    persist(courses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCourse = (id: string) => {
    persist(courses.filter((c) => c.id !== id));
  };

  const addDeadline = (courseId: string) => {
    const row: PlannedDeadline = {
      id: crypto.randomUUID(),
      label: "Milestone",
      dueISO: new Date().toISOString().slice(0, 10)
    };
    persist(
      courses.map((c) => (c.id === courseId ? { ...c, deadlines: [...c.deadlines, row] } : c))
    );
  };

  const updateDeadline = (courseId: string, did: string, patch: Partial<PlannedDeadline>) => {
    persist(
      courses.map((c) =>
        c.id !== courseId
          ? c
          : {
              ...c,
              deadlines: c.deadlines.map((d) => (d.id === did ? { ...d, ...patch } : d))
            }
      )
    );
  };

  const removeDeadline = (courseId: string, did: string) => {
    persist(
      courses.map((c) =>
        c.id !== courseId ? c : { ...c, deadlines: c.deadlines.filter((d) => d.id !== did) }
      )
    );
  };

  const total = totalPlannerCredits(courses);

  return (
    <div>
      <div className="text-sm text-slate-600">
        <Link to="/app/dashboard" className="text-[#0056D2] hover:underline">
          Dashboard
        </Link>
        {" · "}
        <Link to="/app/academic" className="text-[#0056D2] hover:underline">
          Academic
        </Link>
        {" / "}Course planner
      </div>

      <header className="mt-4 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Course planner</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-700">
            Sketch terms, registrations, or study goals. Add milestones (exams, projects) with due dates — all stored locally in your
            browser.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-[#fafbfc] px-4 py-2 text-sm">
            <span className="text-slate-500">Planned credits</span>
            <span className="ml-2 font-semibold tabular-nums text-slate-900">{total}</span>
          </div>
          <Button type="button" onClick={addCourse}>
            <Plus className="h-4 w-4" aria-hidden /> Add course
          </Button>
        </div>
      </header>

      {courses.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">No planned courses yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Mirror your registration or a tentative schedule. You can revise anytime — this stays separate from tutor-generated study
            paths.
          </p>
          <Button type="button" className="mt-6" onClick={addCourse}>
            Add your first row
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {courses.map((c, idx) => (
            <li key={c.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planned course {idx + 1}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => removeCourse(c.id)}
                  aria-label="Remove course"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-12">
                <label className="md:col-span-2 md:grid">
                  <span className="text-xs text-slate-600">Term</span>
                  <input
                    value={c.term}
                    onChange={(e) => updateCourse(c.id, { term: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                    placeholder="Fall 2026"
                  />
                </label>
                <label className="md:col-span-2 md:grid">
                  <span className="text-xs text-slate-600">Code</span>
                  <input
                    value={c.courseCode}
                    onChange={(e) => updateCourse(c.id, { courseCode: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                    placeholder="BIA 674"
                  />
                </label>
                <label className="md:col-span-5 md:grid">
                  <span className="text-xs text-slate-600">Title</span>
                  <input
                    value={c.title}
                    onChange={(e) => updateCourse(c.id, { title: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                    placeholder="Machine Learning Apps"
                  />
                </label>
                <label className="md:col-span-3 md:grid">
                  <span className="text-xs text-slate-600">Credits</span>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={c.credits}
                    onChange={(e) => updateCourse(c.id, { credits: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                  />
                </label>
              </div>

              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">Deadlines & milestones</span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#0056D2] hover:underline"
                    onClick={() => addDeadline(c.id)}
                  >
                    + Add deadline
                  </button>
                </div>
                {c.deadlines.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">Optional — midterms, project phases, registrar dates you want visible.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {c.deadlines.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 bg-[#fafbfc] px-3 py-2">
                        <label className="min-w-[140px] flex-1">
                          <span className="text-[11px] text-slate-500">Label</span>
                          <input
                            value={d.label}
                            onChange={(e) => updateDeadline(c.id, d.id, { label: e.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label>
                          <span className="text-[11px] text-slate-500">Due</span>
                          <input
                            type="date"
                            value={d.dueISO.slice(0, 10)}
                            onChange={(e) => updateDeadline(c.id, d.id, { dueISO: e.target.value })}
                            className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeDeadline(c.id, d.id)}
                          aria-label="Remove deadline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
