import { useState } from "react";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import type { StudentProfile } from "../../lib/types";
import { INTEREST_OPTIONS, SKILL_LEVEL_OPTIONS } from "../../lib/academic/catalog";
import { ALL_PROGRAMS, PROGRAM_LABELS } from "../../data/stevensData";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25";
const labelCls = "block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1";

function completeness(p: StudentProfile): number {
  const fields = [
    p.fullName?.trim(),
    p.major?.trim(),
    p.currentSemester?.trim(),
    (p.careerInterests ?? []).length > 0 ? "yes" : "",
    p.creditComfort > 0 ? "yes" : "",
    p.strengths?.trim() ?? ""
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

type Props = {
  profile: StudentProfile;
  onChange: (p: StudentProfile | Partial<StudentProfile>) => void;
};

export function IntelligentProfilePanel({ profile, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [careerDraft, setCareerDraft] = useState("");
  const [completedDraft, setCompletedDraft] = useState("");

  const pct = completeness(profile);
  const careers = profile.careerInterests ?? [];
  const completed = profile.skills ?? [];
  const interests = (profile.tools ?? []) as string[];

  const set = (patch: Partial<StudentProfile>) => {
    // onChange is useProfile's updateProfile — it auto-saves
    onChange({ ...profile, ...patch } as StudentProfile);
  };

  const addCareer = () => {
    const t = careerDraft.trim();
    if (!t) return;
    if (careers.map((c) => c.toLowerCase()).includes(t.toLowerCase())) { setCareerDraft(""); return; }
    set({ careerInterests: [...careers, t] });
    setCareerDraft("");
  };

  const removeCareer = (i: number) => {
    const next = [...careers]; next.splice(i, 1);
    set({ careerInterests: next });
  };

  const addCompleted = () => {
    const t = completedDraft.trim();
    if (!t) return;
    if (completed.includes(t)) { setCompletedDraft(""); return; }
    set({ skills: [...completed, t] });
    setCompletedDraft("");
  };

  const removeCompleted = (i: number) => {
    const next = [...completed]; next.splice(i, 1);
    set({ skills: next });
  };

  const toggleInterest = (tag: string) => {
    const has = interests.includes(tag);
    set({ tools: has ? interests.filter((t) => t !== tag) : [...interests, tag] });
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <User className="h-5 w-5 text-[#0056D2]" />
        <div
          className="h-24 w-2 overflow-hidden rounded-full bg-slate-100"
          title={`Profile ${pct}% complete`}
        >
          <div className="w-full rounded-full bg-[#0056D2] transition-all" style={{ height: `${pct}%` }} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
          title="Expand profile panel"
        >
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-[300px] lg:shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-[#0056D2]" />
          <span className="text-sm font-semibold text-slate-900">Intelligent Profile</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-xl border border-slate-200 p-1.5 hover:bg-slate-50"
          title="Collapse"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600" />
        </button>
      </div>

      {/* Completeness bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Profile completeness</span>
          <span className={pct >= 80 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-red-700"}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-[#0056D2]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct < 80 && (
          <p className="mt-1 text-[10px] text-slate-500">Fill more fields for better AI recommendations</p>
        )}
      </div>

      <div className="space-y-4 overflow-y-auto">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={profile.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Your name" />
        </div>

        <div>
          <label className={labelCls}>Stevens program</label>
          <select
            className={inputCls}
            value={profile.stevensProgram ?? ""}
            onChange={(e) => {
              const key = e.target.value;
              const prog = ALL_PROGRAMS.find((p) => p.key === key);
              set({
                stevensProgram: key || undefined,
                programName: prog?.label ?? (key ? key : undefined),
                major: prog ? prog.degree : profile.major,
                concentration: undefined // reset when program changes
              });
            }}
          >
            <option value="">— Select your program —</option>
            {PROGRAM_LABELS.map((p) => (
              <option key={p.key} value={p.key}>{p.degree} — {p.label}</option>
            ))}
          </select>
        </div>

        {/* Concentration — only shown when the selected program has concentrations */}
        {(() => {
          const prog = ALL_PROGRAMS.find((p) => p.key === profile.stevensProgram);
          if (!prog?.concentrations?.length) return null;
          return (
            <div>
              <label className={labelCls}>Concentration</label>
              <select
                className={inputCls}
                value={profile.concentration ?? ""}
                onChange={(e) => set({ concentration: e.target.value || undefined })}
              >
                <option value="">— Any / not decided —</option>
                {prog.concentrations.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          );
        })()}

        <div>
          <label className={labelCls}>Current semester</label>
          <select
            className={inputCls}
            value={profile.currentSemester}
            onChange={(e) => set({ currentSemester: e.target.value })}
          >
            <option value="">— Select term —</option>
            <option>Spring 2026</option>
            <option>Summer 2026</option>
            <option>Fall 2026</option>
            <option>Spring 2027</option>
            <option>Summer 2027</option>
            <option>Fall 2027</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Education background</label>
          <input className={inputCls} value={profile.previousDegree ?? ""} onChange={(e) => set({ previousDegree: e.target.value || undefined })} placeholder="e.g. B.E. Mechanical Engineering" />
        </div>

        <div>
          <label className={labelCls}>Skill level</label>
          <select
            className={inputCls}
            value={profile.gaps ?? "Intermediate"}
            onChange={(e) => set({ gaps: e.target.value })}
          >
            {SKILL_LEVEL_OPTIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>GPA (optional)</label>
          <input
            className={inputCls}
            type="number"
            step="0.01"
            min={0}
            max={4}
            value={profile.gpa ?? ""}
            onChange={(e) => set({ gpa: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="3.5"
          />
        </div>

        <div>
          <label className={labelCls}>
            <span className="flex items-center justify-between">
              <span>Completed courses</span>
              {profile.isF1Student && <span className="rounded-full bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-semibold text-[#0056D2]">F-1</span>}
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {completed.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                {c}
                <button type="button" onClick={() => removeCompleted(i)} className="text-slate-400 hover:text-red-600">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#0056D2]/25"
              value={completedDraft}
              onChange={(e) => setCompletedDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompleted(); } }}
              placeholder="e.g. BIA 600"
            />
            <button type="button" onClick={addCompleted} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold hover:bg-slate-50">Add</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Career interests</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {careers.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[#0056D2]/30 bg-[#F2F7FF] px-2 py-0.5 text-xs font-medium text-slate-900">
                {c}
                <button type="button" onClick={() => removeCareer(i)} className="text-slate-400 hover:text-red-600">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#0056D2]/25"
              value={careerDraft}
              onChange={(e) => setCareerDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCareer(); } }}
              placeholder="e.g. Data Scientist"
            />
            <button type="button" onClick={addCareer} className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold hover:bg-slate-50">Add</button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Interests</label>
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleInterest(tag)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                  interests.includes(tag)
                    ? "border-[#0056D2] bg-[#0056D2] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 cursor-pointer">
          <span className="text-sm text-slate-800">F-1 Student</span>
          <input type="checkbox" checked={profile.isF1Student} onChange={(e) => set({ isF1Student: e.target.checked })} className="accent-[#0056D2]" />
        </label>
      </div>
    </aside>
  );
}
