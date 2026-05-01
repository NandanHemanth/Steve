export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export type LessonKind =
  | "slides"
  | "flashcards"
  | "mindmap"
  | "reading"
  | "infographic"
  | "quiz"
  | "audio_script"
  | "data_table"
  | "game";

/** AI may return loosely shaped objects; LessonContent validates per kind */
export type LessonPayload = Record<string, unknown>;

export type TutorLesson = {
  id: string;
  moduleId: string;
  title: string;
  kind: LessonKind;
  minutesEstimate: number;
  payload: LessonPayload;
  completedAtISO?: string;
};

export type TutorModule = {
  id: string;
  title: string;
  summary: string;
  hoursToComplete: number;
  lessons: TutorLesson[];
};

export type DiagnosticQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type DiagnosticState = {
  questions: DiagnosticQuestion[];
  answers?: Record<string, number>;
  skipped?: boolean;
  scorePct?: number;
};

export type StudyDayChunk = {
  id: string;
  index: number;
  dateISO: string;
  deadlineISO: string;
  lessonIds: string[];
  renewedByDays: number;
};

export type TutorCourse = {
  id: string;
  title: string;
  subtitle?: string;
  subject: string;
  createdAtISO: string;
  sourceSnippet: string;
  /** Full uploaded source text (e.g., PDF extraction), clipped for storage. */
  sourceText?: string;
  /** Page-separated PDF text (clipped per page); used for page-level guides. */
  sourcePages?: string[];
  /** Page-level explanations aligned to sourcePages indices. */
  pageGuide?: { page: number; title: string; summary: string; keyPoints: string[] }[];
  outcomes: string[];
  skillsTags: string[];
  toolsTags: string[];
  weeksTotal: number;
  hoursPerWeek: number;
  learningStartISO: string;
  /** Sun=0 … Sat=6 — true means study day */
  studyDaysMask: boolean[];
  difficultyBand: DifficultyLevel;
  modules: TutorModule[];
  diagnostic?: DiagnosticState;
  scheduleChunks: StudyDayChunk[];
};

export function defaultStudyDaysMask(): boolean[] {
  const m = Array(7).fill(false);
  m[1] = m[2] = m[3] = m[4] = m[5] = true;
  return m;
}
