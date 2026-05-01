import type { TutorCourse } from "./types";
import { flattenLessons } from "./schedulePlans";

export function lessonProgress(course: TutorCourse) {
  const flat = flattenLessons(course.modules);
  const done = flat.filter((l) => l.completedAtISO).length;
  const totalMinutes = flat.reduce((s, l) => s + (l.minutesEstimate || 0), 0);
  const doneMinutes = flat.filter((l) => l.completedAtISO).reduce((s, l) => s + (l.minutesEstimate || 0), 0);
  return {
    done,
    total: flat.length,
    pct: flat.length ? Math.round((done / flat.length) * 100) : 0,
    totalMinutes,
    doneMinutes
  };
}

function todayLocalStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function localStampFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Consecutive study days ending today or yesterday (if today empty) — local calendar */
export function streakDays(course: TutorCourse): number {
  const flat = flattenLessons(course.modules);
  const stamps = flat.map((l) => (l.completedAtISO ? localStampFromIso(l.completedAtISO) : "")).filter(Boolean);
  const set = new Set(stamps);
  if (!set.size) return 0;
  let d = new Date();
  let key = todayLocalStamp();
  if (!set.has(key)) {
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    key = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const ks = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (set.has(ks)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export function totalsAcrossCourses(list: TutorCourse[]) {
  let courses = list.length;
  let sumPct = 0;
  let lessonsDone = 0;
  let lessonsTotal = 0;
  let minutesLearned = 0;
  for (const c of list) {
    const p = lessonProgress(c);
    sumPct += p.pct;
    lessonsDone += p.done;
    lessonsTotal += p.total;
    minutesLearned += p.doneMinutes;
  }
  return {
    courses,
    avgPct: courses ? Math.round(sumPct / courses) : 0,
    lessonsDone,
    lessonsTotal,
    minutesLearned
  };
}

export function lessonsDueToday(course: TutorCourse, todayStamp = todayLocalStamp()) {
  const chunk = course.scheduleChunks.filter((ch) => ch.dateISO <= todayStamp);
  const overdue = chunk.filter(
    (ch) => localStampFromIso(ch.deadlineISO) < todayStamp && ch.lessonIds.some((lid) => !isLessonDone(course, lid))
  );
  const today = chunk.find((ch) => ch.dateISO === todayStamp);
  return { overdueChunks: overdue, todayChunk: today };
}

function isLessonDone(course: TutorCourse, id: string) {
  const flat = flattenLessons(course.modules);
  return Boolean(flat.find((l) => l.id === id)?.completedAtISO);
}
