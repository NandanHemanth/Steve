import { stevensCourses, stevensPrograms, type StevensCourse, type StevensProgram } from "./stevensData.js";

type PlanSlice = {
  programId?: string | null;
  completed?: string[];
  wishlist?: string[];
  semesters?: Record<string, string[]>;
};

function normalizeCourseCode(raw: string): string {
  let s = raw.toUpperCase().trim().replace(/\s+/g, "-");
  if (!s.includes("-") && /^[A-Z]{2,6}\d{2,4}$/.test(s)) {
    const m = s.match(/^([A-Z]{2,6})(\d{2,4})$/);
    if (m) s = `${m[1]}-${m[2]}`;
  }
  return s.replace(/[^A-Z0-9-]/g, "");
}

export function findCourseFlexible(code: string): StevensCourse | undefined {
  const n = normalizeCourseCode(code);
  return stevensCourses.find((c) => normalizeCourseCode(c.code) === n);
}

function collectCodesFromPlan(plan?: PlanSlice): string[] {
  if (!plan) return [];
  const out: string[] = [];
  for (const c of plan.completed ?? []) out.push(c);
  for (const c of plan.wishlist ?? []) out.push(c);
  for (const sem of Object.values(plan.semesters ?? {})) {
    for (const c of sem ?? []) out.push(c);
  }
  return [...new Set(out)];
}

export function resolveProgramId(profile: Record<string, unknown>): string | null {
  const plan = profile.stevensPlan as PlanSlice | undefined;
  const fromPlan = typeof plan?.programId === "string" && plan.programId.length ? plan.programId : null;
  if (fromPlan) return fromPlan;

  const major = String(profile.major ?? "").toLowerCase();
  const programName = String(profile.programName ?? "").toLowerCase();
  const hay = `${major} ${programName}`;

  if (hay.includes("information systems") || hay.includes("msis")) return "msmis-demo";
  if (hay.includes("computer science") || /\bmscs\b/.test(hay)) return "mscs-demo";
  if (
    hay.includes("business analytics") ||
    hay.includes("analytics & artificial intelligence") ||
    hay.includes("business analytics & ai")
  ) {
    return "msbai-demo";
  }

  return null;
}

function programById(id: string | null): StevensProgram | undefined {
  if (!id) return undefined;
  return stevensPrograms.find((p) => p.id === id);
}

/** Courses relevant to student's program core/electives + anything already on their plan. */
export function resolveCatalogForProfile(profile: Record<string, unknown>): {
  program: StevensProgram | undefined;
  programId: string | null;
  courses: StevensCourse[];
} {
  const programId = resolveProgramId(profile);
  const program = programById(programId);
  const planCodes = collectCodesFromPlan(profile.stevensPlan as PlanSlice | undefined);
  const selected = new Map<string, StevensCourse>();

  for (const raw of planCodes) {
    const hit = findCourseFlexible(raw);
    if (hit) selected.set(hit.code, hit);
  }

  if (program) {
    for (const code of program.core) {
      const hit = findCourseFlexible(code);
      if (hit) selected.set(hit.code, hit);
    }
    const tagPool = program.electiveTags ?? [];
    if (tagPool.length === 0) {
      for (const c of stevensCourses) selected.set(c.code, c);
    } else {
      const lowered = tagPool.map((t) => t.toLowerCase());
      for (const c of stevensCourses) {
        const match = c.tags.some((t) => lowered.includes(t.toLowerCase()));
        if (match) selected.set(c.code, c);
      }
    }
  }

  if (selected.size === 0) {
    for (const c of stevensCourses) selected.set(c.code, c);
  }

  const courses = Array.from(selected.values()).sort((a, b) => a.code.localeCompare(b.code));

  return { program, programId, courses };
}

export function buildAdvisorStevensContext(profile: Record<string, unknown> | undefined): string {
  if (!profile) {
    return [
      "### STEVE Stevens catalog injection",
      "No profile JSON received; use general Stevens guidance without inventing specific course codes."
    ].join("\n");
  }

  const { program, programId, courses } = resolveCatalogForProfile(profile);
  const snapshot = courses.map((c) => ({
    code: c.code,
    title: c.title,
    credits: c.credits,
    prerequisites: c.prerequisites ?? [],
    workload: c.workload,
    tags: c.tags
  }));

  const allCodesJson = JSON.stringify(stevensCourses.map((c) => c.code));
  const programLine = program
    ? `Program match: "${program.name}" (${program.degreeLevel}). Core requirement codes: ${program.core.join(", ")}. Elective relevance tags: ${(program.electiveTags ?? []).join(", ") || "(see tag overlap in catalog)"}.`
    : `No program matched from profile.planner or major/programName fields. Showing broad catalog (${snapshot.length} courses).`;

  return [
    "### STEVE Stevens catalog (demo dataset — not live catalog scrape)",
    "This block is authoritative for WHICH course codes exist in STEVE tonight. Instructor names and CRNs change every term — those live in Workday/schedule only.",
    `Resolved program id: ${programId ?? "(none)"}.`,
    programLine,
    "Personalize using BOTH the student profile JSON and this catalog snapshot (prereqs + workload + fit for career/target).",
    "STRICT_RULES:",
    "- Only cite course codes listed in authoritativeCodes below (normalize spaces/hyphens: CS 615 ≡ CS-615). Never invent MIS/CS/FIN/etc. sections or professors.",
    "- If asked about professors/sections/CRNs: say rosters are in Stevens Workday; STEVE demo catalog excludes faculty scheduling.",
    "- If asked about a code not in authoritativeCodes: say it's not loaded in STEVE's demo snapshot and advise Workday/catalog; don't guess prerequisites or syllabus.",
    "authoritativeCodes: " + allCodesJson,
    "personalizedCourseSnapshot:",
    JSON.stringify(snapshot)
  ].join("\n");
}
