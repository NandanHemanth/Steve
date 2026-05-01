export type StevensService = {
  id: string;
  name: string;
  whatTheyHandle: string[];
  location?: string;
  hours?: string;
  contact?: { email?: string; phone?: string; url?: string };
};

export type StevensEvent = {
  id: string;
  title: string;
  category: "Career" | "Academic" | "Social" | "Wellness" | "Workshop";
  startsAtISO: string;
  location?: string;
  description?: string;
  url?: string;
};

export type StevensDegreeLevel = "Undergraduate" | "Masters" | "PhD" | "Other";

export type StevensCourse = {
  code: string;
  title: string;
  credits: number;
  description: string;
  prerequisites?: string[];
  workload: "Low" | "Medium" | "High";
  tags: string[];
  /** Home unit / subject area (demo labeling — not an official Workday export). */
  department?: string;
  /** If omitted, course is treated as open to all demo degree levels. */
  degreeLevelsAllowed?: StevensDegreeLevel[];
  /** Advisory only: STEVE warns when profile GPA is below this threshold. */
  minGpaSuggested?: number;
};

export type StevensProgram = {
  id: string;
  name: string;
  degreeLevel: StevensDegreeLevel;
  totalCredits: number;
  core: string[];
  electivesMin: number;
  electiveTags?: string[];
  browsePrefixes?: string[];
  notes?: string;
};

export const stevensServices: StevensService[] = [
  {
    id: "isss",
    name: "International Student and Scholar Services (ISSS)",
    whatTheyHandle: ["F-1 status questions", "I-20 updates", "CPT/OPT guidance", "full-time enrollment questions"],
    contact: { url: "https://www.stevens.edu" }
  },
  {
    id: "registrar",
    name: "Office of the Registrar",
    whatTheyHandle: ["course registration", "add/drop", "transcripts", "graduation requirements", "academic calendar"],
    contact: { url: "https://www.stevens.edu" }
  },
  {
    id: "bursar",
    name: "Student Accounts / Bursar",
    whatTheyHandle: ["tuition bills", "payment plans", "fees", "holds related to payments"],
    contact: { url: "https://www.stevens.edu" }
  },
  {
    id: "career",
    name: "Stevens Career Center",
    whatTheyHandle: ["career fairs", "resume reviews", "internship search", "job search strategy"],
    contact: { url: "https://www.stevens.edu" }
  },
  {
    id: "counseling",
    name: "Counseling and Psychological Services",
    whatTheyHandle: ["mental health support", "stress management resources", "counseling appointments"],
    contact: { url: "https://www.stevens.edu" }
  }
];

/**
 * Large demo snapshot (multi-department) for hackathon UX.
 * Swap this array for a Workday/catalog ETL pipeline in production.
 */
export const stevensCourses: StevensCourse[] = [
  // ——— Computer Science ———
  {
    code: "CS-115",
    title: "Introduction to Computer Science",
    credits: 3,
    description: "Problem decomposition, introductory programming patterns, introductory computing ecosystems.",
    prerequisites: [],
    workload: "Medium",
    tags: ["python", "foundations"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "CS-284",
    title: "Data Structures",
    credits: 3,
    description: "Lists, trees, hashing, heaps, asymptotics — bridge to downstream systems coursework.",
    prerequisites: ["CS-115"],
    workload: "High",
    tags: ["algorithms", "foundations"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "CS-385",
    title: "Design & Analysis of Algorithms",
    credits: 3,
    description: "Classic algorithm design techniques, amortized analysis basics, proofs at undergraduate depth.",
    prerequisites: ["CS-284"],
    workload: "High",
    tags: ["algorithms", "theory"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate"],
    minGpaSuggested: 3.0
  },
  {
    code: "CS-492",
    title: "Software Engineering Studio (Demo)",
    credits: 3,
    description: "Team delivery, testing, reviews, release cadence for a small product-like project.",
    prerequisites: ["CS-284"],
    workload: "High",
    tags: ["software", "systems"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "CS-501",
    title: "Programming for Data Science",
    credits: 3,
    description: "Python programming, data wrangling, and practical tooling for analytics and ML workflows.",
    prerequisites: [],
    workload: "Medium",
    tags: ["python", "data", "foundations"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "CS-513",
    title: "Knowledge Discovery & Data Mining",
    credits: 3,
    description: "Core data mining methods, evaluation, and applied projects using real datasets.",
    prerequisites: ["CS-501"],
    workload: "Medium",
    tags: ["data-mining", "ml", "analytics"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.1
  },
  {
    code: "CS-559",
    title: "Machine Learning Fundamentals",
    credits: 3,
    description: "Supervised/unsupervised learning, model evaluation, and foundational ML practice.",
    prerequisites: ["CS-501"],
    workload: "High",
    tags: ["ml", "ai"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.2
  },
  {
    code: "CS-615",
    title: "Database Management Systems",
    credits: 3,
    description: "Relational model, SQL, transactions, indexing, and systems design fundamentals.",
    prerequisites: [],
    workload: "High",
    tags: ["databases", "systems"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate", "Masters", "PhD"]
  },
  {
    code: "CS-570",
    title: "Ethics in Computing",
    credits: 3,
    description: "Professional and societal impacts of computing, privacy, fairness, responsible practice.",
    prerequisites: [],
    workload: "Low",
    tags: ["ethics", "policy"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Undergraduate", "Masters", "PhD"]
  },
  {
    code: "CS-590",
    title: "Algorithm Design & Analysis",
    credits: 3,
    description: "Core algorithmic paradigms, complexity, and proofs with implementation emphasis.",
    prerequisites: [],
    workload: "High",
    tags: ["algorithms", "theory", "systems"],
    department: "Computer Science",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.1
  },
  // ——— Mathematics ———
  {
    code: "MA-121",
    title: "Differential Calculus (Demo)",
    credits: 4,
    description: "Limits, differentiation, introductory optimization as used across engineering programs.",
    prerequisites: [],
    workload: "High",
    tags: ["math", "foundations"],
    department: "Mathematics",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MA-221",
    title: "Integral Calculus & Series (Demo)",
    credits: 4,
    description: "Integration techniques, sequences/series bridging probability and differential equations.",
    prerequisites: ["MA-121"],
    workload: "High",
    tags: ["math", "foundations"],
    department: "Mathematics",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MA-541",
    title: "Statistical Learning for Engineers (Demo)",
    credits: 3,
    description: "Linear models, inference, experimentation basics for quantitative graduate programs.",
    prerequisites: [],
    workload: "High",
    tags: ["statistics", "analytics"],
    department: "Mathematics",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  // ——— Chemistry / Physics (Schaefer) ———
  {
    code: "CHE-151",
    title: "General Chemistry I (Demo)",
    credits: 4,
    description: "Stoichiometry, equilibrium, thermochemistry foundations for STEM pathways.",
    prerequisites: [],
    workload: "High",
    tags: ["chemistry", "lab"],
    department: "Chemistry & Chemical Biology",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "PEP-111",
    title: "Physics I — Mechanics (Demo)",
    credits: 3,
    description: "Kinematics, forces, energy, momentum labs with engineering emphasis.",
    prerequisites: [],
    workload: "High",
    tags: ["physics", "foundations"],
    department: "Physics",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "CHE-660",
    title: "Process Analytics & Sensors (Demo)",
    credits: 3,
    description: "SPC, sensor pipelines, KPI monitoring for pilot-scale reaction systems (hackathon syllabus).",
    prerequisites: [],
    workload: "High",
    tags: ["chemical-engineering", "analytics"],
    department: "Chemical Engineering & Materials Science",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  // ——— Business / MIS / BIA / FIN / MGT ———
  {
    code: "ACC-205",
    title: "Financial Accounting Foundations (Demo)",
    credits: 3,
    description: "Financial statements, accruals, budgeting vocabulary for analytic tracks.",
    prerequisites: [],
    workload: "Medium",
    tags: ["accounting", "finance"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "FIN-301",
    title: "Corporate Finance (Demo)",
    credits: 3,
    description: "TVOM, capital budgeting, leverage basics for business undergraduates.",
    prerequisites: [],
    workload: "High",
    tags: ["finance", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MKT-330",
    title: "Digital Marketing Measurement (Demo)",
    credits: 3,
    description: "Acquisition funnels, campaign experiments, KPI dashboards for omnichannel journeys.",
    prerequisites: [],
    workload: "Medium",
    tags: ["marketing", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "BIA-215",
    title: "Business Analytics Foundations (Demo)",
    credits: 3,
    description: "Spreadsheet + SQL introductions for descriptive analytics workflows across business functions.",
    prerequisites: [],
    workload: "Medium",
    tags: ["analytics", "sql"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MIS-237",
    title: "Business Information Systems (Demo)",
    credits: 3,
    description: "ERP mental models, data flows, KPI ownership between business & IT counterparts.",
    prerequisites: [],
    workload: "Low",
    tags: ["mis", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MGT-250",
    title: "Organizational Behavior (Demo)",
    credits: 3,
    description: "Teams, motivation, influence — helpful before analytics-heavy group projects.",
    prerequisites: [],
    workload: "Low",
    tags: ["management"],
    department: "School of Business",
    degreeLevelsAllowed: ["Undergraduate"]
  },
  {
    code: "MIS-636",
    title: "Enterprise Data Governance",
    credits: 3,
    description: "Data quality, stewardship, lineage, roles, privacy, risk, accountable analytics operations.",
    prerequisites: [],
    workload: "Medium",
    tags: ["mis", "governance", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "MIS-637",
    title: "Data Visualization and Communication",
    credits: 3,
    description:
      "Dashboards and storytelling using analytics outputs. Instructor rosters finalize in Workday each term.",
    prerequisites: [],
    workload: "Medium",
    tags: ["mis", "viz", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "MIS-640",
    title: "Information Systems Strategy",
    credits: 3,
    description: "Aligning technology investments with organizational strategy and change management basics.",
    prerequisites: [],
    workload: "Low",
    tags: ["mis", "management", "strategy"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "MIS-658",
    title: "Information Security Governance (Demo)",
    credits: 3,
    description: "Cyber risk registers, SOC collaboration, tabletop exercises for managerial audiences.",
    prerequisites: ["CS-615"],
    workload: "Medium",
    tags: ["mis", "risk"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "BIA-652",
    title: "Predictive Modeling for Decision Making",
    credits: 3,
    description: "Regression/classification uplift with interpretation for managerial tradeoffs.",
    prerequisites: ["CS-501"],
    workload: "High",
    tags: ["analytics", "ml", "data-mining"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.15
  },
  {
    code: "BIA-662",
    title: "Big Data Platforms — Capstone Prep (Demo)",
    credits: 3,
    description: "Batch/stream mental models plus governance checkpoints before integrative BA projects.",
    prerequisites: ["CS-513"],
    workload: "High",
    tags: ["analytics", "systems"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.2
  },
  {
    code: "BIA-680",
    title: "Analytics Practicum (Demo)",
    credits: 3,
    description: "Team analytics project bridging dashboards, KPIs, and stakeholder readouts.",
    prerequisites: ["CS-501"],
    workload: "High",
    tags: ["analytics", "capstone"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.25
  },
  {
    code: "MGT-614",
    title: "Project & Program Leadership",
    credits: 3,
    description: "Prioritization, agile execution, stakeholder management for analytics portfolios.",
    prerequisites: [],
    workload: "Low",
    tags: ["management", "leadership"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "MGT-645",
    title: "Negotiations for Technical Leaders (Demo)",
    credits: 3,
    description: "Interest-based bargaining applied to roadmap conflicts and vendor conversations.",
    prerequisites: [],
    workload: "Low",
    tags: ["management"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "FIN-627",
    title: "Quantitative Models in Finance",
    credits: 3,
    description: "Excel/Python-based modeling scenarios for budgeting, forecasting, valuation.",
    prerequisites: [],
    workload: "High",
    tags: ["finance", "analytics"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.05
  },
  {
    code: "FIN-658",
    title: "Derivatives Modeling Lab (Demo)",
    credits: 3,
    description: "Simulation-first view of sensitivities/variation for illustrative portfolios.",
    prerequisites: ["FE-611"],
    workload: "High",
    tags: ["finance", "quant"],
    department: "School of Business",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "FE-611",
    title: "Stochastic Processes for Engineers",
    credits: 3,
    description: "Discrete/continuous stochastic models used in simulations and risk-informed decisions.",
    prerequisites: [],
    workload: "High",
    tags: ["quant", "financial-engineering", "analytics"],
    department: "Financial Engineering",
    degreeLevelsAllowed: ["Masters", "PhD"],
    minGpaSuggested: 3.25
  },
  // ——— SSE / interdisciplinary demos ———
  {
    code: "EM-605",
    title: "Engineering Economy & Portfolio Decisions (Demo)",
    credits: 3,
    description: "NPV/IRR contrasts, staged investment decisions aligned to capital projects labs.",
    prerequisites: [],
    workload: "Medium",
    tags: ["engineering-management", "finance"],
    department: "Systems & Enterprises",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "SYS-628",
    title: "Model-Based Systems Integration (Demo)",
    credits: 3,
    description: "Interface control, lifecycle views, modeling language sketch for complex systems demos.",
    prerequisites: [],
    workload: "High",
    tags: ["systems-engineering"],
    department: "Systems & Enterprises",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "CE-582",
    title: "Resilient Infrastructure Analytics (Demo)",
    credits: 3,
    description: "Condition monitoring + maintenance optimization storytelling for civic-scale assets.",
    prerequisites: [],
    workload: "High",
    tags: ["civil-engineering", "analytics"],
    department: "Civil Environmental & Ocean Engineering",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "EE-582",
    title: "Edge AI Systems (Demo)",
    credits: 3,
    description: "Latency-aware inference concerns for embedded-ish intelligent edge demonstrations.",
    prerequisites: ["CS-501"],
    workload: "High",
    tags: ["electrical-engineering", "ai"],
    department: "Electrical & Computer Engineering",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  {
    code: "BME-591",
    title: "Biomedical Signals & Sensors (Demo)",
    credits: 3,
    description: "Acquisition, noise, feature sketching pipelines for illustrative physiological datasets.",
    prerequisites: [],
    workload: "High",
    tags: ["biomedical-engineering", "signals"],
    department: "Biomedical Engineering",
    degreeLevelsAllowed: ["Masters", "PhD"]
  },
  // ——— HASS ———
  {
    code: "HUM-275",
    title: "Ethics & Technology in Society (Demo)",
    credits: 3,
    description: "Narratives around automation bias, fairness, oversight — complements CS‑570 narratives.",
    prerequisites: [],
    workload: "Low",
    tags: ["humanities", "ethics"],
    department: "Humanities Arts & Social Sciences",
    degreeLevelsAllowed: ["Undergraduate", "Masters"]
  }
];

export const stevensPrograms: StevensProgram[] = [
  {
    id: "bscs-ug-demo",
    name: "BS Computer Science (Hackathon Demo)",
    degreeLevel: "Undergraduate",
    totalCredits: 120,
    core: ["CS-115", "CS-284", "CS-385", "CS-615", "CS-570"],
    electivesMin: 80,
    electiveTags: ["algorithms", "systems", "ml", "software", "databases"],
    browsePrefixes: ["CS", "MA"],
    notes: "Undergraduate checklist mock. Substitute registrar requirements for honors/concentrations."
  },
  {
    id: "bsba-ug-demo",
    name: "BS Business — Analytics Concentration (Demo)",
    degreeLevel: "Undergraduate",
    totalCredits: 120,
    core: ["ACC-205", "FIN-301", "BIA-215", "MIS-237", "MGT-250"],
    electivesMin: 82,
    electiveTags: ["analytics", "finance", "marketing", "mis", "management"],
    browsePrefixes: ["ACC", "FIN", "BIA", "MIS", "MGT", "MKT"],
    notes: "Undergraduate analytics-focused track mock. Advisors still rule in reality."
  },
  {
    id: "mscs-demo",
    name: "MS Computer Science (Hackathon Demo)",
    degreeLevel: "Masters",
    totalCredits: 30,
    core: ["CS-615", "CS-559"],
    electivesMin: 24,
    electiveTags: ["systems", "ml", "ai", "databases", "ethics", "algorithms", "theory"],
    browsePrefixes: ["CS", "EE"],
    notes: "Demo structure only; pull official MCS rules from registrar if available."
  },
  {
    id: "msbai-demo",
    name: "MS Business Analytics & AI (Hackathon Demo)",
    degreeLevel: "Masters",
    totalCredits: 30,
    core: ["CS-501", "CS-513"],
    electivesMin: 24,
    electiveTags: ["python", "data-mining", "ml", "analytics", "mis", "viz", "management", "governance"],
    browsePrefixes: ["BIA", "MIS", "MGT", "FIN", "FE"],
    notes: "Many analytics paths still require foundational technical cores while electives skew business prefixes."
  },
  {
    id: "msmis-demo",
    name: "MS Information Systems (Hackathon Demo)",
    degreeLevel: "Masters",
    totalCredits: 30,
    core: ["MIS-637", "MIS-636", "CS-615"],
    electivesMin: 21,
    electiveTags: ["mis", "viz", "governance", "management", "databases", "analytics", "systems"],
    browsePrefixes: ["MIS", "BIA", "MGT", "FIN"],
    notes: "Blends MIS leadership + technical data courses; Workday dictates real CRNs/rosters."
  }
];

export const stevensPolicies = {
  f1: {
    fullTimeMinCredits: {
      Undergraduate: 12,
      Masters: 9,
      PhD: 9,
      Other: 9
    },
    note:
      "Rule-of-thumb only. Always confirm with Stevens ISSS for your specific situation and term rules (e.g., final semester, RCL, thesis).",
    onlineCreditReminder:
      "Online course limits and exceptions vary. Ask ISSS if a course is online/hybrid and you’re near the limit."
  },
  tuition: {
    note:
      "Demo estimates. Replace with official Stevens tuition tables for your program/term in production.",
    perCreditUSD: {
      Undergraduate: 1600,
      Masters: 2200,
      PhD: 2200,
      Other: 2000
    },
    estimatedFeesUSD: 1200
  }
} as const;

export const stevensEvents: StevensEvent[] = [
  {
    id: "career-fair",
    title: "Stevens Career Fair (Demo)",
    category: "Career",
    startsAtISO: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    location: "Gateway Center (Demo)",
    description: "Bring your resume. RSVP in STEVE to add it to your calendar.",
    url: "https://www.stevens.edu"
  },
  {
    id: "workshop-interview",
    title: "Interview Prep Workshop (Demo)",
    category: "Workshop",
    startsAtISO: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    location: "Babbio Center (Demo)",
    description: "Behavioral + technical interview preparation.",
    url: "https://www.stevens.edu"
  }
];
