import type { StudentProfile } from "./types";

/** Defaults for local storage-backed profile (merge unknown/partial blobs safely). */
export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  fullName: "",
  degreeLevel: "Masters",
  major: "",
  currentSemester: "",
  gpa: undefined,
  isF1Student: false,
  targetCareer: "",
  careerInterests: [],
  budgetSensitivity: "Medium",
  creditComfort: 9,
  university: "Stevens Institute of Technology",
  programName: undefined,
  previousDegree: undefined,
  previousUniversity: undefined,
  graduationYear: undefined,
  strengths: undefined,
  gaps: undefined,
  skills: undefined,
  tools: undefined,
  workHoursPerWeek: undefined,
  prefersMorningClasses: false,
  avoidsFriday: false,
  riskTolerance: "Medium",
  costSensitivityNotes: undefined,
  linkedInUrl: undefined,
  linkedInPaste: undefined,
  notes: undefined
};

function trimList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((s) => String(s).trim()).filter(Boolean);
}

/** Merge persisted JSON into a full StudentProfile + migrate legacy `targetCareer`. */
export function migrateStudentProfile(input: Partial<StudentProfile> | null | undefined): StudentProfile | null {
  if (input == null) return null;
  const m: StudentProfile = { ...DEFAULT_STUDENT_PROFILE, ...input };
  let interests = trimList(m.careerInterests);
  if (!interests.length && m.targetCareer?.trim()) {
    interests = [m.targetCareer.trim()];
  }
  if (!interests.length && "targetCareer" in input) {
    const tc = String((input as { targetCareer?: unknown }).targetCareer ?? "").trim();
    if (tc) interests = [tc];
  }
  const targetCareer = interests[0] ?? "";
  return { ...m, careerInterests: interests, targetCareer };
}

/** Before persist: keep careers deduped; sync deprecated `targetCareer` from first choice. */
export function finalizeStudentProfile(p: StudentProfile): StudentProfile {
  const seen = new Set<string>();
  const interests: string[] = [];
  for (const raw of trimList(p.careerInterests)) {
    const k = raw.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      interests.push(raw);
    }
  }
  return {
    ...p,
    careerInterests: interests,
    targetCareer: interests[0] ?? ""
  };
}

export function profileCareersLabel(p: StudentProfile | Partial<StudentProfile> | null | undefined): string | null {
  if (!p) return null;
  const base = { ...DEFAULT_STUDENT_PROFILE, ...(p as Partial<StudentProfile>) } as StudentProfile;
  let interests = trimList(base.careerInterests);
  if (!interests.length && base.targetCareer?.trim()) interests = [base.targetCareer.trim()];
  const s = finalizeStudentProfile({ ...base, careerInterests: interests }).careerInterests.join(", ");
  return s || null;
}
