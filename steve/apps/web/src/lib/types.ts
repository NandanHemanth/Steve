export type StudentProfile = {
  fullName: string;
  degreeLevel: "Undergraduate" | "Masters" | "PhD" | "Other";
  major: string;
  currentSemester: string;
  gpa?: number;
  isF1Student: boolean;
  /** @deprecated synced from careerInterests[0] on save — use careerInterests for display */
  targetCareer?: string;
  /** Careers or paths STEVE should align examples and tone toward (multiple allowed). */
  careerInterests?: string[];
  budgetSensitivity: "Low" | "Medium" | "High";
  creditComfort: number;
  university?: "Stevens Institute of Technology";
  programName?: string; // e.g. "Business Analytics & Artificial Intelligence"
  /** Stevens catalog program key — e.g. "MS_Business_Intelligence_and_Analytics" */
  stevensProgram?: string;
  /** Selected concentration within the program (e.g. "Data Science and AI") */
  concentration?: string;
  /** Credits completed so far at Stevens */
  creditsCompleted?: number;
  /** Expected graduation term, e.g. "Spring 2027" */
  expectedGraduation?: string;
  /** Thesis or project track (for programs that offer a choice) */
  academicTrack?: "project" | "thesis" | "coursework";
  /** Course IDs currently enrolled in this semester */
  enrolledCourses?: string[];
  /** Academic standing */
  academicStanding?: "Good Standing" | "Probation" | "Dean's List";
  /** Advisor name at Stevens */
  advisorName?: string;

  // Background
  previousDegree?: string; // e.g. "B.E. Mechanical Engineering"
  previousUniversity?: string;
  graduationYear?: string;
  strengths?: string; // free text
  gaps?: string; // free text (what they feel weak at)
  skills?: string[]; // tags
  tools?: string[]; // tags

  // Preferences + constraints
  /** @deprecated Unused in UI; kept for old saved profiles. */
  workHoursPerWeek?: number;
  prefersMorningClasses?: boolean;
  /** @deprecated Not used in the current profile UI. */ 
  avoidsFriday?: boolean;
  riskTolerance?: "Low" | "Medium" | "High";
  costSensitivityNotes?: string;

  // LinkedIn (no scraping; user-provided)
  linkedInUrl?: string;
  linkedInPaste?: string; // user pastes About/Experience/Skills text

  notes?: string;
};

export type GroqKeys = {
  keys: string[]; // up to 5
  activeIndex?: number;
};

