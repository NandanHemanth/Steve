/** Course catalog and degree requirements used by the AI Course Planner. */

export type CatalogCourse = {
  id: string;
  code: string;
  title: string;
  credits: number;
  department: string;
  category: "Core" | "Elective" | "Tools & Skills";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  prereqs: string[]; // course ids
  skills: string[];
  tags: string[];
  description: string;
};

export type RequirementBucket = {
  label: string;
  courseIds: string[]; // eligible course ids for this bucket
  minCredits: number;
  minCount?: number;
};

export type DegreeRequirements = {
  program: string;
  totalCredits: number;
  minGradePerCourse: number; // e.g. 2.0 = C
  f1MinCreditsPerTerm: number;
  buckets: RequirementBucket[];
};

export const COURSES: CatalogCourse[] = [
  {
    id: "BIA600",
    code: "BIA 600",
    title: "Introduction to Business Analytics",
    credits: 3,
    department: "Business",
    category: "Core",
    difficulty: "Beginner",
    prereqs: [],
    skills: ["Data Analysis", "Excel", "Statistics"],
    tags: ["Analytics", "Business"],
    description: "Foundations of business analytics including data interpretation, visualization, and decision-making."
  },
  {
    id: "BIA652",
    code: "BIA 652",
    title: "Statistical Methods for Data Science",
    credits: 3,
    department: "Business",
    category: "Core",
    difficulty: "Intermediate",
    prereqs: ["BIA600"],
    skills: ["Statistics", "R", "Python"],
    tags: ["Statistics", "Data Science"],
    description: "Applied statistical modeling including regression, hypothesis testing, and Bayesian methods."
  },
  {
    id: "BIA660",
    code: "BIA 660",
    title: "Machine Learning for Business",
    credits: 3,
    department: "Business",
    category: "Core",
    difficulty: "Intermediate",
    prereqs: ["BIA652"],
    skills: ["Machine Learning", "Python", "scikit-learn"],
    tags: ["AI", "ML", "Data Science"],
    description: "Supervised and unsupervised ML applied to business problems. Classification, clustering, forecasting."
  },
  {
    id: "BIA674",
    code: "BIA 674",
    title: "Big Data Technologies",
    credits: 3,
    department: "Business",
    category: "Elective",
    difficulty: "Intermediate",
    prereqs: ["BIA600"],
    skills: ["Spark", "Hadoop", "SQL"],
    tags: ["Big Data", "Engineering"],
    description: "Large-scale data processing with Hadoop, Spark, and distributed storage systems."
  },
  {
    id: "BIA678",
    code: "BIA 678",
    title: "Deep Learning & Neural Networks",
    credits: 3,
    department: "Business",
    category: "Elective",
    difficulty: "Advanced",
    prereqs: ["BIA660"],
    skills: ["Deep Learning", "PyTorch", "TensorFlow"],
    tags: ["AI", "Deep Learning"],
    description: "CNNs, RNNs, Transformers and generative models applied to real-world datasets."
  },
  {
    id: "BIA668",
    code: "BIA 668",
    title: "Natural Language Processing",
    credits: 3,
    department: "Business",
    category: "Elective",
    difficulty: "Advanced",
    prereqs: ["BIA660"],
    skills: ["NLP", "Transformers", "Python"],
    tags: ["AI", "NLP"],
    description: "Text analytics, sentiment analysis, BERT/GPT architectures, and enterprise NLP applications."
  },
  {
    id: "BIA686",
    code: "BIA 686",
    title: "Data Visualization & Storytelling",
    credits: 3,
    department: "Business",
    category: "Elective",
    difficulty: "Beginner",
    prereqs: ["BIA600"],
    skills: ["Tableau", "Power BI", "D3.js"],
    tags: ["Visualization", "Communication"],
    description: "Designing effective dashboards and data stories with Tableau, Power BI, and web-based tools."
  },
  {
    id: "BIA690",
    code: "BIA 690",
    title: "AI Ethics & Governance",
    credits: 3,
    department: "Business",
    category: "Core",
    difficulty: "Beginner",
    prereqs: [],
    skills: ["Ethics", "Policy", "Risk Management"],
    tags: ["Ethics", "AI", "Business"],
    description: "Regulatory landscape, bias, fairness, explainability, and organizational AI governance."
  },
  {
    id: "BIA698",
    code: "BIA 698",
    title: "Capstone: Applied AI Project",
    credits: 3,
    department: "Business",
    category: "Core",
    difficulty: "Advanced",
    prereqs: ["BIA660", "BIA652"],
    skills: ["Project Management", "ML", "Communication"],
    tags: ["Capstone", "Industry"],
    description: "End-to-end AI/analytics project with industry partner. Requirements to graduation."
  },
  {
    id: "CS583",
    code: "CS 583",
    title: "Machine Learning",
    credits: 3,
    department: "Computer Science",
    category: "Elective",
    difficulty: "Intermediate",
    prereqs: [],
    skills: ["Machine Learning", "Python", "Linear Algebra"],
    tags: ["ML", "CS"],
    description: "Theory and algorithms behind supervised and unsupervised learning methods."
  },
  {
    id: "CS590",
    code: "CS 590",
    title: "Advanced Topics in AI",
    credits: 3,
    department: "Computer Science",
    category: "Elective",
    difficulty: "Advanced",
    prereqs: ["CS583"],
    skills: ["Reinforcement Learning", "Planning", "AI"],
    tags: ["AI", "CS"],
    description: "State-of-the-art AI: reinforcement learning, game theory, multi-agent systems."
  }
];

export const DEGREE_REQUIREMENTS: DegreeRequirements = {
  program: "MS Business Analytics & Artificial Intelligence",
  totalCredits: 30,
  minGradePerCourse: 2.0,
  f1MinCreditsPerTerm: 9,
  buckets: [
    {
      label: "Core Requirements",
      courseIds: ["BIA600", "BIA652", "BIA660", "BIA690", "BIA698"],
      minCredits: 15,
      minCount: 5
    },
    {
      label: "Electives",
      courseIds: ["BIA674", "BIA678", "BIA668", "BIA686", "CS583", "CS590"],
      minCredits: 12
    },
    {
      label: "Capstone",
      courseIds: ["BIA698"],
      minCredits: 3,
      minCount: 1
    }
  ]
};

export const INTEREST_OPTIONS = [
  "AI", "Machine Learning", "Data Science", "NLP", "Deep Learning",
  "Analytics", "Visualization", "Ethics", "Big Data", "Cloud",
  "Product Management", "Entrepreneurship"
];

export const SKILL_LEVEL_OPTIONS: CatalogCourse["difficulty"][] = ["Beginner", "Intermediate", "Advanced"];

export function courseById(id: string): CatalogCourse | undefined {
  return COURSES.find((c) => c.id === id);
}

export function checkPrereqs(courseId: string, completedIds: Set<string>): { ok: boolean; missing: string[] } {
  const course = courseById(courseId);
  if (!course) return { ok: true, missing: [] };
  const missing = course.prereqs.filter((p) => !completedIds.has(p));
  return { ok: missing.length === 0, missing };
}
