import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import type { StudentProfile } from "../lib/types";
import { Button } from "../components/ui/Button";
import { useProfile } from "../lib/useProfile";
import { ALL_PROGRAMS, PROGRAM_LABELS } from "../data/stevensData";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay }
});

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0056D2]/25";

const SEMESTERS = ["Spring 2025", "Summer 2025", "Fall 2025", "Spring 2026", "Summer 2026", "Fall 2026", "Spring 2027", "Summer 2027", "Fall 2027", "Spring 2028"];

function SectionCard({ title, subtitle, children, delay = 0 }: {
  title: string; subtitle?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.section {...fadeUp(delay)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </motion.section>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Chips({
  items, onRemove, emptyText
}: { items: string[]; onRemove: (i: number) => void; emptyText: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.length === 0
        ? <span className="text-xs text-slate-400">{emptyText}</span>
        : items.map((c, i) => (
          <span key={`${c}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-[#0056D2]/30 bg-[#F2F7FF] px-2.5 py-0.5 text-xs font-medium text-slate-800">
            {c}
            <button type="button" onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
    </div>
  );
}

function ChipInput({ value, onChange, onAdd, placeholder }: {
  value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
      />
      <button type="button" onClick={onAdd}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Add
      </button>
    </div>
  );
}

export function ProfileBuilderPage() {
  const { profile, updateProfile, setProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  // Chip drafts
  const [careerDraft, setCareerDraft] = useState("");
  const [completedDraft, setCompletedDraft] = useState("");
  const [enrolledDraft, setEnrolledDraft] = useState("");

  const upd = (patch: Partial<StudentProfile>) => updateProfile(patch);

  const selectedProg = ALL_PROGRAMS.find((p) => p.key === profile.stevensProgram);
  const hasConcentrations = (selectedProg?.concentrations?.length ?? 0) > 0;

  const addChip = (field: "careerInterests" | "skills" | "enrolledCourses", value: string) => {
    if (!value.trim()) return;
    const existing = (profile[field] as string[] | undefined) ?? [];
    if (existing.map((x) => x.toLowerCase()).includes(value.toLowerCase().trim())) return;
    upd({ [field]: [...existing, value.trim()] });
  };

  const removeChip = (field: "careerInterests" | "skills" | "enrolledCourses", index: number) => {
    const existing = [...((profile[field] as string[] | undefined) ?? [])];
    existing.splice(index, 1);
    upd({ [field]: existing });
  };

  const save = () => { setProfile(profile); setSaved(true); setTimeout(() => setSaved(false), 1800); };

  return (
    <div className="mx-auto max-w-4xl">
      <motion.div {...fadeUp(0)} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Intelligent Profile</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Your Academic Profile</h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-xl">
            Fill in your current college status. STEVE uses this to recommend the right courses, set correct pacing, and personalize every AI response — no repeated setup.
          </p>
        </div>
        <Button onClick={save} className="shrink-0">Save profile</Button>
      </motion.div>

      {/* Auto-save indicator */}
      <motion.div {...fadeUp(0.04)} className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
        <span className={`inline-block h-2 w-2 rounded-full ${saved ? "bg-emerald-600" : "bg-emerald-400"}`} />
        {saved ? "Saved and synced across the entire app." : "Auto-saving — changes sync instantly to Course Planner and AI Tutor."}
      </motion.div>

      <div className="mt-5 space-y-4">
        {/* ── 1. Identity ── */}
        <SectionCard title="Personal info" subtitle="Your name and contact info." delay={0.05}>
          <FieldRow>
            <Field label="Preferred name">
              <input className={input} value={profile.fullName} onChange={(e) => upd({ fullName: e.target.value })} placeholder="e.g. Abhishek" />
            </Field>
            <Field label="Academic advisor (optional)">
              <input className={input} value={profile.advisorName ?? ""} onChange={(e) => upd({ advisorName: e.target.value || undefined })} placeholder="e.g. Dr. Smith" />
            </Field>
          </FieldRow>
        </SectionCard>

        {/* ── 2. Program & enrollment ── */}
        <SectionCard title="Program & enrollment" subtitle="Your degree, program, and current semester at Stevens." delay={0.08}>
          <FieldRow>
            <Field label="Stevens program">
              <select className={input} value={profile.stevensProgram ?? ""}
                onChange={(e) => {
                  const key = e.target.value;
                  const prog = ALL_PROGRAMS.find((p) => p.key === key);
                  upd({ stevensProgram: key || undefined, programName: prog?.label, major: prog?.degree ?? profile.major, concentration: undefined });
                }}>
                <option value="">— Select your program —</option>
                {PROGRAM_LABELS.map((p) => <option key={p.key} value={p.key}>{p.degree} — {p.label}</option>)}
              </select>
            </Field>
            <Field label="Degree level">
              <select className={input} value={profile.degreeLevel}
                onChange={(e) => upd({ degreeLevel: e.target.value as StudentProfile["degreeLevel"] })}>
                <option>Undergraduate</option>
                <option>Masters</option>
                <option>PhD</option>
                <option>Other</option>
              </select>
            </Field>
          </FieldRow>

          {hasConcentrations && (
            <Field label="Concentration">
              <select className={input} value={profile.concentration ?? ""}
                onChange={(e) => upd({ concentration: e.target.value || undefined })}>
                <option value="">— Any / not yet decided —</option>
                {selectedProg!.concentrations!.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}

          <FieldRow>
            <Field label="Current semester">
              <select className={input} value={profile.currentSemester}
                onChange={(e) => upd({ currentSemester: e.target.value })}>
                <option value="">— Select —</option>
                {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Expected graduation">
              <select className={input} value={profile.expectedGraduation ?? ""}
                onChange={(e) => upd({ expectedGraduation: e.target.value || undefined })}>
                <option value="">— Select —</option>
                {SEMESTERS.filter((s) => s >= (profile.currentSemester || "Spring 2026")).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Academic track">
              <select className={input} value={profile.academicTrack ?? "coursework"}
                onChange={(e) => upd({ academicTrack: e.target.value as StudentProfile["academicTrack"] })}>
                <option value="coursework">Coursework only</option>
                <option value="project">Project track</option>
                <option value="thesis">Thesis track</option>
              </select>
            </Field>
            <Field label="Academic standing">
              <select className={input} value={profile.academicStanding ?? "Good Standing"}
                onChange={(e) => upd({ academicStanding: e.target.value as StudentProfile["academicStanding"] })}>
                <option>Good Standing</option>
                <option>Dean's List</option>
                <option>Probation</option>
              </select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Credits completed at Stevens">
              <input type="number" min={0} max={120} className={input}
                value={profile.creditsCompleted ?? ""}
                onChange={(e) => upd({ creditsCompleted: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="e.g. 12" />
            </Field>
            <Field label="Self-reported GPA">
              <input type="number" step="0.01" min={0} max={4} className={input}
                value={profile.gpa ?? ""}
                onChange={(e) => upd({ gpa: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="e.g. 3.75" />
            </Field>
          </FieldRow>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-900">International / F-1 student</div>
              <div className="text-xs text-slate-500">Enables minimum 9 credits/semester warning in Course Planner</div>
            </div>
            <input type="checkbox" checked={profile.isF1Student} onChange={(e) => upd({ isF1Student: e.target.checked })} className="h-4 w-4 accent-[#0056D2]" />
          </label>
        </SectionCard>

        {/* ── 3. Completed courses ── */}
        <SectionCard title="Completed courses" subtitle="Courses you've already finished — the Course Planner will not recommend these." delay={0.11}>
          <Chips items={profile.skills ?? []} onRemove={(i) => removeChip("skills", i)} emptyText="No completed courses added yet." />
          <ChipInput value={completedDraft} onChange={setCompletedDraft} placeholder='e.g. "BIA 580" or "MIS 631"'
            onAdd={() => { addChip("skills", completedDraft); setCompletedDraft(""); }} />
          <p className="text-xs text-slate-500">Enter Stevens course codes exactly (e.g. BIA 580, EE 602). These sync to the Course Planner automatically.</p>
        </SectionCard>

        {/* ── 4. Currently enrolled ── */}
        <SectionCard title="Currently enrolled courses" subtitle="Courses you're taking this semester — shown in My Plan as 'In progress'." delay={0.14}>
          <Chips items={profile.enrolledCourses ?? []} onRemove={(i) => removeChip("enrolledCourses", i)} emptyText="No courses marked as in-progress." />
          <ChipInput value={enrolledDraft} onChange={setEnrolledDraft} placeholder='e.g. "AAI 595"'
            onAdd={() => { addChip("enrolledCourses", enrolledDraft); setEnrolledDraft(""); }} />
        </SectionCard>

        {/* ── 5. Career goals ── */}
        <SectionCard title="Career goals" subtitle="Add multiple — STEVE tailors course recommendations and examples to all of them." delay={0.17}>
          <Chips items={profile.careerInterests ?? []} onRemove={(i) => removeChip("careerInterests", i)} emptyText="No career goals added yet." />
          <ChipInput value={careerDraft} onChange={setCareerDraft} placeholder='e.g. "AI Engineer", "Product Manager"'
            onAdd={() => { addChip("careerInterests", careerDraft); setCareerDraft(""); }} />
        </SectionCard>

        {/* ── 6. Background & learning ── */}
        <SectionCard title="Background & learning style" subtitle="Helps STEVE pick the right difficulty and frame examples." delay={0.2}>
          <FieldRow>
            <Field label="Previous degree">
              <input className={input} value={profile.previousDegree ?? ""} onChange={(e) => upd({ previousDegree: e.target.value || undefined })} placeholder="e.g. B.E. Mechanical Engineering" />
            </Field>
            <Field label="Previous university">
              <input className={input} value={profile.previousUniversity ?? ""} onChange={(e) => upd({ previousUniversity: e.target.value || undefined })} placeholder="e.g. Mumbai University" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Strengths">
              <textarea className={input} rows={3} value={profile.strengths ?? ""}
                onChange={(e) => upd({ strengths: e.target.value || undefined })}
                placeholder="e.g. SQL, statistics, data visualization" />
            </Field>
            <Field label="Want more support on">
              <textarea className={input} rows={3} value={profile.gaps ?? ""}
                onChange={(e) => upd({ gaps: e.target.value || undefined })}
                placeholder="e.g. deep learning theory, calculus" />
            </Field>
          </FieldRow>
        </SectionCard>

        {/* ── 7. Optional extras ── */}
        <details className="group rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-1">
          <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 marker:text-[#0056D2]">
            Optional — resume / LinkedIn / notes
            <span className="mt-0.5 block text-xs font-normal text-slate-500 group-open:hidden">
              Paste your LinkedIn or any extra notes STEVE should know about.
            </span>
          </summary>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <Field label="Resume or LinkedIn paste (plain text)">
              <textarea className={input} rows={6} value={profile.linkedInPaste ?? ""}
                onChange={(e) => upd({ linkedInPaste: e.target.value || undefined })}
                placeholder="Paste your About / Experience / Skills section from LinkedIn." />
            </Field>
            <Field label="Other notes">
              <textarea className={input} rows={3} value={profile.notes ?? ""}
                onChange={(e) => upd({ notes: e.target.value || undefined })}
                placeholder="Anything else STEVE should know." />
            </Field>
          </div>
        </details>
      </div>

      {/* Progress summary */}
      <motion.div {...fadeUp(0.24)} className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Profile completeness</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Program", ok: !!profile.stevensProgram },
            { label: "Semester", ok: !!profile.currentSemester },
            { label: "Career goals", ok: (profile.careerInterests?.length ?? 0) > 0 },
            { label: "Completed courses", ok: (profile.skills?.length ?? 0) > 0 },
            { label: "Credits done", ok: !!profile.creditsCompleted },
            { label: "Graduation plan", ok: !!profile.expectedGraduation },
            { label: "Background", ok: !!profile.previousDegree },
            { label: "GPA", ok: profile.gpa != null }
          ].map((f) => (
            <div key={f.label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${f.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-500"}`}>
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${f.ok ? "text-emerald-600" : "text-slate-300"}`} />
              {f.label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
