export type PlannedDeadline = {
  id: string;
  label: string;
  dueISO: string;
};

export type PlannedCourse = {
  id: string;
  term: string;
  courseCode: string;
  title: string;
  credits: number;
  deadlines: PlannedDeadline[];
};

export type CoursePlannerState = {
  courses: PlannedCourse[];
};
