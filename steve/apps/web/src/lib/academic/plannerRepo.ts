import { loadJson, saveJson, storageKeys } from "../storage";
import type { CoursePlannerState, PlannedCourse } from "./types";

const KEY = storageKeys.coursePlanner;

const empty: CoursePlannerState = { courses: [] };

export function loadPlanner(): CoursePlannerState {
  const raw = loadJson<CoursePlannerState>(KEY, empty);
  if (!raw?.courses || !Array.isArray(raw.courses)) return empty;
  return raw;
}

export function savePlanner(state: CoursePlannerState) {
  saveJson(KEY, state);
}

export function totalPlannerCredits(courses: PlannedCourse[]): number {
  return courses.reduce((s, c) => s + (typeof c.credits === "number" ? c.credits : 0), 0);
}
