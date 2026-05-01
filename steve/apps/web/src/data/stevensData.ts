/**
 * Parses stevens_courses.json into strongly-typed structures used by the
 * Course Planner (SmartRecommender, RequirementValidator, MyCoursePlan).
 */
import RAW from "./stevens_courses.json";

// ─── Primitive types ──────────────────────────────────────────────────────────

export type StevensCourse = {
  id: string;           // code stripped of spaces: "BIA580"
  code: string;         // "BIA 580"
  name: string;
  credits: number;
  department: string;
  description: string;
  prerequisites: string;
  typicallyOffered: string;
  /** Which pool this came from, e.g. "core", "data_analytics_concentration_electives" */
  poolKey: string;
};

export type RequirementBucket = {
  key: string;
  label: string;
  courseIds: string[];        // StevensCourse ids eligible for this bucket
  minCredits: number;
  minCourses?: number;
  /** All listed courses are mandatory (no choice) */
  allRequired?: boolean;
  notes?: string;
};

export type StevensProgram = {
  key: string;
  label: string;              // Human-readable, used in dropdown
  degree: string;
  catalogYear: string;
  department: string;
  totalCreditsRequired: number;
  minimumGpa?: number;
  concentrations?: string[];
  courses: StevensCourse[];
  buckets: RequirementBucket[];
  url: string;
};

// ─── Parser helpers ───────────────────────────────────────────────────────────

function codeToId(code: string): string {
  return code.replace(/\s+/g, "");
}

function parseCourse(raw: Record<string, unknown>, poolKey: string): StevensCourse {
  const code = String(raw.code ?? "");
  const creditsRaw = raw.credits;
  const credits =
    typeof creditsRaw === "number"
      ? creditsRaw
      : typeof creditsRaw === "string"
        ? parseInt(creditsRaw, 10) || 3
        : 3;
  return {
    id: codeToId(code),
    code,
    name: String(raw.name ?? ""),
    credits,
    department: String(raw.distribution ?? ""),
    description: String(raw.description ?? ""),
    prerequisites: String(raw.prerequisites ?? "None"),
    typicallyOffered: String(raw.typically_offered ?? ""),
    poolKey
  };
}

function extractPoolCourses(pool: unknown, poolKey: string): StevensCourse[] {
  if (!pool || typeof pool !== "object") return [];
  const p = pool as Record<string, unknown>;
  const arr = Array.isArray(p.courses) ? p.courses : [];
  return (arr as Record<string, unknown>[]).map((c) => parseCourse(c, poolKey));
}

// ─── Program parsers ──────────────────────────────────────────────────────────

function parseBIA(key: string, raw: Record<string, unknown>): StevensProgram {
  const pools = raw.course_pools as Record<string, unknown>;
  const reqs = raw.degree_requirements as Record<string, unknown>;
  const breakdown = reqs?.breakdown as Record<string, unknown> ?? {};
  const coreBk = breakdown.core as Record<string, unknown> ?? {};
  const concBk = breakdown.concentration_electives as Record<string, unknown> ?? {};

  const coreCourses = extractPoolCourses(pools.core, "core");
  const daElectives = extractPoolCourses(pools.data_analytics_concentration_electives, "data_analytics");
  const dsaiElectives = extractPoolCourses(pools.data_science_and_ai_concentration_electives, "data_science_ai");
  const bigDataRequired = extractPoolCourses(pools.big_data_concentration_required, "big_data");
  const additionalElectives = extractPoolCourses(pools.additional_electives, "additional");

  // Deduplicate by id
  const dedup = (arr: StevensCourse[]) => {
    const seen = new Set<string>();
    return arr.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  };

  const allElectives = dedup([...daElectives, ...dsaiElectives, ...bigDataRequired, ...additionalElectives]);
  const allCourses = dedup([...coreCourses, ...allElectives]);

  const buckets: RequirementBucket[] = [
    {
      key: "core",
      label: "Core Courses (all required)",
      courseIds: coreCourses.map((c) => c.id),
      minCredits: coreCourses.reduce((s, c) => s + c.credits, 0),
      minCourses: Number(coreBk.courses_required ?? 11),
      allRequired: true,
      notes: String(coreBk.note ?? "")
    },
    {
      key: "data_analytics",
      label: "Data Analytics Concentration (choose 3)",
      courseIds: daElectives.map((c) => c.id),
      minCredits: Number(concBk.credits_required ?? 9),
      minCourses: Number(concBk.courses_required ?? 3),
      notes: "Choose any 3 from the Data Analytics concentration pool"
    },
    {
      key: "data_science_ai",
      label: "Data Science & AI Concentration (choose 3)",
      courseIds: dsaiElectives.map((c) => c.id),
      minCredits: Number(concBk.credits_required ?? 9),
      minCourses: Number(concBk.courses_required ?? 3),
      notes: "Choose any 3 from the Data Science and AI pool"
    },
    {
      key: "big_data",
      label: "Big Data Concentration (BIA 678 required + 2 from DS&AI)",
      courseIds: bigDataRequired.map((c) => c.id).concat(dsaiElectives.map((c) => c.id)),
      minCredits: 9,
      minCourses: 3,
      notes: "BIA 678 is mandatory; choose 2 additional from Data Science and AI pool"
    }
  ];

  return {
    key,
    label: "MS Business Intelligence and Analytics (BIA)",
    degree: String(raw.degree ?? "Master of Science"),
    catalogYear: String(raw.catalog_year ?? ""),
    department: String(raw.department ?? ""),
    totalCreditsRequired: Number(raw.total_credits_required ?? 36),
    minimumGpa: Number((reqs?.minimum_gpa as number) ?? 3.0),
    concentrations: Array.isArray(raw.concentrations) ? raw.concentrations.map(String) : [],
    courses: allCourses,
    buckets,
    url: String(raw.url ?? "")
  };
}

function parseMERobotics(key: string, raw: Record<string, unknown>): StevensProgram {
  const pools = raw.course_pools as Record<string, unknown>;
  const reqs = raw.degree_requirements as Record<string, unknown>;
  const breakdown = reqs?.breakdown as Record<string, unknown> ?? {};

  const tools = extractPoolCourses(pools.engineering_tools_and_methods, "tools");
  const core = extractPoolCourses(pools.robotics_core, "robotics_core");
  const meElectives = extractPoolCourses(pools.me_robotics_electives, "me_electives");
  const csElectives = extractPoolCourses(pools.cs_ee_cpe_ma_electives, "cs_ee_electives");

  const dedup = (arr: StevensCourse[]) => {
    const seen = new Set<string>();
    return arr.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  };

  const allCourses = dedup([...tools, ...core, ...meElectives, ...csElectives]);

  const toolsBk = breakdown.engineering_tools_and_methods as Record<string, unknown> ?? {};
  const coreBk = breakdown.robotics_core as Record<string, unknown> ?? {};
  const electivesBk = breakdown.electives as Record<string, unknown> ?? {};

  const buckets: RequirementBucket[] = [
    {
      key: "tools",
      label: "Engineering Tools & Methods (choose 1)",
      courseIds: tools.map((c) => c.id),
      minCredits: Number(toolsBk.credits_required ?? 3),
      minCourses: Number(toolsBk.courses_required ?? 1),
      notes: String(toolsBk.note ?? "")
    },
    {
      key: "robotics_core",
      label: "Robotics Core (choose 3)",
      courseIds: core.map((c) => c.id),
      minCredits: Number(coreBk.credits_required ?? 9),
      minCourses: Number(coreBk.courses_required ?? 3),
      notes: String(coreBk.note ?? "")
    },
    {
      key: "me_electives",
      label: "ME Robotics Electives (min 2)",
      courseIds: meElectives.map((c) => c.id),
      minCredits: 6,
      minCourses: 2,
      notes: String((electivesBk as any)?.me_robotics_electives?.note ?? "")
    },
    {
      key: "cs_ee_electives",
      label: "CS / EE / CPE / MA Electives (min 2)",
      courseIds: csElectives.map((c) => c.id),
      minCredits: 6,
      minCourses: 2,
      notes: String((electivesBk as any)?.cs_ee_cpe_ma_electives?.note ?? "")
    }
  ];

  return {
    key,
    label: "ME Robotics",
    degree: String(raw.degree ?? "Master of Engineering"),
    catalogYear: String(raw.catalog_year ?? ""),
    department: String(raw.department ?? ""),
    totalCreditsRequired: Number(raw.total_credits_required ?? 30),
    concentrations: [],
    courses: allCourses,
    buckets,
    url: String(raw.url ?? "")
  };
}

function parseAAI(key: string, raw: Record<string, unknown>): StevensProgram {
  const pools = raw.course_pools as Record<string, unknown>;
  const reqs = raw.degree_requirements as Record<string, unknown>;
  const breakdown = reqs?.breakdown as Record<string, unknown> ?? {};

  const foundation = extractPoolCourses(pools.mathematical_foundation, "foundation");
  const core = extractPoolCourses(pools.core, "core");
  const concPool = (pools.concentration_courses as Record<string, unknown>) ?? {};
  const capstone = extractPoolCourses(pools.project_and_thesis, "capstone");

  const concCourses: StevensCourse[] = [];
  for (const [concKey, concData] of Object.entries(concPool)) {
    if (typeof concData !== "object" || !concData) continue;
    const courses = (concData as Record<string, unknown>).courses;
    if (Array.isArray(courses)) {
      concCourses.push(...courses.map((c) => parseCourse(c as Record<string, unknown>, `concentration_${concKey}`)));
    }
  }

  const dedup = (arr: StevensCourse[]) => {
    const seen = new Set<string>();
    return arr.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  };

  const allCourses = dedup([...foundation, ...core, ...concCourses, ...capstone]);

  const mathBk = breakdown.mathematical_foundation as Record<string, unknown> ?? {};
  const coreBk = breakdown.core as Record<string, unknown> ?? {};
  const concBk = breakdown.concentration as Record<string, unknown> ?? {};

  const buckets: RequirementBucket[] = [
    {
      key: "foundation",
      label: "Mathematical Foundation (choose 1)",
      courseIds: foundation.map((c) => c.id),
      minCredits: Number(mathBk.credits_required ?? 3),
      minCourses: Number(mathBk.courses_required ?? 1),
      notes: String(mathBk.note ?? "")
    },
    {
      key: "core",
      label: "Core Courses (choose 4)",
      courseIds: core.map((c) => c.id),
      minCredits: Number(coreBk.credits_required ?? 12),
      minCourses: Number(coreBk.courses_required ?? 4),
      notes: String(coreBk.note ?? "")
    },
    {
      key: "concentration",
      label: "Concentration Courses (choose 3 from one area)",
      courseIds: dedup(concCourses).map((c) => c.id),
      minCredits: Number(concBk.credits_required ?? 9),
      minCourses: Number(concBk.courses_required ?? 3),
      notes: String(concBk.note ?? "")
    },
    {
      key: "capstone",
      label: "Project / Thesis (6 credits)",
      courseIds: capstone.map((c) => c.id),
      minCredits: 6,
      notes: "AAI 800 Project Course (3cr) + 1 elective (3cr), or thesis track (6cr)"
    }
  ];

  return {
    key,
    label: "MS Applied Artificial Intelligence",
    degree: String(raw.degree ?? "Master of Science"),
    catalogYear: String(raw.catalog_year ?? ""),
    department: String(raw.department ?? ""),
    totalCreditsRequired: Number(raw.total_credits_required ?? 30),
    concentrations: Array.isArray(raw.concentrations) ? raw.concentrations.map(String) : [],
    courses: allCourses,
    buckets,
    url: String(raw.url ?? "")
  };
}

// ─── Build all programs ───────────────────────────────────────────────────────

const rawPrograms = (RAW as { programs: Record<string, Record<string, unknown>> }).programs;

const PROGRAMS: StevensProgram[] = Object.entries(rawPrograms).map(([key, raw]) => {
  if (key === "MS_Business_Intelligence_and_Analytics") return parseBIA(key, raw);
  if (key === "ME_Robotics") return parseMERobotics(key, raw);
  if (key === "MS_Applied_Artificial_Intelligence") return parseAAI(key, raw);
  // Fallback generic parser
  const pools = (raw.course_pools as Record<string, unknown>) ?? {};
  const courses: StevensCourse[] = [];
  for (const [poolKey, pool] of Object.entries(pools)) {
    courses.push(...extractPoolCourses(pool, poolKey));
  }
  return {
    key,
    label: String((raw.program as string) ?? key),
    degree: String(raw.degree ?? "Masters"),
    catalogYear: String(raw.catalog_year ?? ""),
    department: String(raw.department ?? ""),
    totalCreditsRequired: Number(raw.total_credits_required ?? 30),
    courses,
    buckets: [],
    url: String(raw.url ?? "")
  };
});

export const ALL_PROGRAMS: StevensProgram[] = PROGRAMS;

export const PROGRAM_LABELS: { key: string; label: string; degree: string }[] = PROGRAMS.map((p) => ({
  key: p.key,
  label: p.label,
  degree: p.degree
}));

export function getProgram(key: string): StevensProgram | undefined {
  return PROGRAMS.find((p) => p.key === key);
}

export function getCourseById(programKey: string, id: string): StevensCourse | undefined {
  return getProgram(programKey)?.courses.find((c) => c.id === id);
}

export function getCourseByCode(programKey: string, code: string): StevensCourse | undefined {
  const id = code.replace(/\s+/g, "");
  return getCourseById(programKey, id);
}
