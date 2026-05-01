import { loadJson, saveJson } from "../storage";
import type { TutorCourse } from "./types";
const KEY = "steve.tutorCourses";

export function loadCourses(): TutorCourse[] {
  return loadJson<TutorCourse[]>(KEY, []);
}

export function saveCourses(all: TutorCourse[]) {
  saveJson(KEY, all);
}

export function getCourse(id: string): TutorCourse | undefined {
  return loadCourses().find((c) => c.id === id);
}

export function upsertCourse(course: TutorCourse) {
  const all = loadCourses().filter((c) => c.id !== course.id);
  all.push(course);
  saveCourses(all);
}

export function patchCourse(id: string, fn: (c: TutorCourse) => TutorCourse): TutorCourse | undefined {
  const c = getCourse(id);
  if (!c) return undefined;
  const next = fn(c);
  upsertCourse(next);
  return next;
}

export function deleteCourse(courseId: string) {
  const all = loadCourses().filter((c) => c.id !== courseId);
  saveCourses(all);
}

export function setLessonCompletion(courseId: string, lessonId: string, done: boolean) {
  patchCourse(courseId, (c) => {
    const mods = c.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) =>
        l.id === lessonId
          ? { ...l, completedAtISO: done ? (l.completedAtISO ?? new Date().toISOString()) : undefined }
          : l
      )
    }));
    return { ...c, modules: mods };
  });
}
