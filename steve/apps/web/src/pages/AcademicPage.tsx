import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, ClipboardList, GraduationCap } from "lucide-react";
import { loadJson, storageKeys } from "../lib/storage";
import type { StudentProfile } from "../lib/types";
import { profileCareersLabel } from "../lib/studentProfile";
import { loadPlanner, totalPlannerCredits } from "../lib/academic/plannerRepo";
import { loadCourses } from "../lib/tutor/repo";

export function AcademicPage() {
  const location = useLocation();
  const profile = useMemo(() => loadJson<StudentProfile | null>(storageKeys.profile, null), []);
  const planner = useMemo(() => loadPlanner(), [location.key, location.pathname]);
  const tutorCount = useMemo(() => loadCourses().length, [location.key]);
  const plannedCredits = totalPlannerCredits(planner.courses);

  return (
    <div>
      <div className="text-sm text-slate-600">
        <Link to="/app/dashboard" className="text-[#0056D2] hover:underline">
          Dashboard
        </Link>{" "}
        / Academic & planning (legacy)
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <GraduationCap className="h-3.5 w-3.5 text-[#0056D2]" aria-hidden />
            Academic hub
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Academic & planning</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
            Use this area for degree-style planning and scheduling. Nothing here replaces your official Stevens degree audit or
            registrar data — it&apos;s a workspace that pairs with your profile and AI tutor tracks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/academic" className="inline-flex items-center gap-2 rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A5BD8]">
            <ClipboardList className="h-4 w-4" aria-hidden />
            Open Academic Hub
          </Link>
          <Link
            to="/app/courses/new"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            New AI course
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["Program", profile?.programName ?? profile?.major ?? "—", "From Intelligent Profile"],
          ["Career interests", profileCareersLabel(profile) ?? "—", "From Intelligent Profile"],
          ["Credit comfort", profile != null ? String(profile.creditComfort) : "—", "Planned load hint / term"],
          ["GPA (self-reported)", profile?.gpa != null ? String(profile.gpa) : "—", "Not from transcript"]
        ].map(([title, value, hint]) => (
          <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{value as string}</div>
            <div className="mt-1 text-xs text-slate-600">{hint as string}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-[#F2F7FF] p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Course planner snapshot</h2>
          <p className="mt-2 text-sm text-slate-800">
            You have <span className="font-semibold">{planner.courses.length}</span> planned course
            {planner.courses.length === 1 ? "" : "s"} totaling <span className="font-semibold">{plannedCredits}</span> credits in
            your workspace.
          </p>
          <Link to="/app/academic/planner" className="mt-4 inline-block text-sm font-semibold text-[#0056D2] hover:underline">
            Edit planned courses & deadlines →
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">AI Intelligent Tutor</h2>
          <p className="mt-2 text-sm text-slate-700">
            {tutorCount
              ? `You have ${tutorCount} generated tutor pathway${tutorCount === 1 ? "" : "s"} tied to syllabus-style material.`
              : "Create personalized study paths from syllabus PDFs or notes — separate from registrar planning."}{" "}
            Manage those from the dashboard or start a new course.
          </p>
          <Link to="/app/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#0056D2] hover:underline">
            Go to dashboard →
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">F‑1 & compliance:</span> planning here is advisory. Always confirm enrollment,
        credits, and visa rules with your academic advisor and international office.
        {profile?.isF1Student ? " Your profile marks you as an F‑1 student — keep real-time registration aligned with their guidance." : null}
      </div>
    </div>
  );
}
