import type { StudyDayChunk, TutorCourse, TutorLesson, TutorModule } from "./types";

function maskCount(mask: boolean[]): number {
  const n = mask.filter(Boolean).length;
  return n > 0 ? n : 5;
}

export function flattenLessons(modules: TutorModule[]): TutorLesson[] {
  const out: TutorLesson[] = [];
  for (const m of modules) {
    for (const l of m.lessons) out.push({ ...l, moduleId: m.id });
  }
  return out;
}

/** Next calendar day that matches study mask — starting from date (same day inclusive), local time */
function nextStudyAnchor(from: Date, mask: boolean[]): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 21; i++) {
    const day = d.getDay();
    if (mask[day]) return d;
    d.setDate(d.getDate() + 1);
  }
  return from;
}

function advanceStudyDay(prev: Date, mask: boolean[]): Date {
  const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
  for (let i = 0; i < 14; i++) {
    const day = d.getDay();
    if (mask[day]) return d;
    d.setDate(d.getDate() + 1);
  }
  return prev;
}

function endOfLocalDay(date: Date): string {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return x.toISOString();
}

function dateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const dd = date.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function rebuildSchedule(course: TutorCourse): TutorCourse {
  const lessons = flattenLessons(course.modules);
  const daysPerWeek = maskCount(course.studyDaysMask);
  const targetDays = Math.max(1, Math.round((course.weeksTotal || 1) * daysPerWeek));
  const totalMinutes = lessons.reduce((s, l) => s + (l.minutesEstimate || 0), 0);
  // Ensure all lessons fit inside the selected timeframe by allocating enough minutes per study day.
  const minuteCap = Math.max(15, Math.ceil(totalMinutes / targetDays));

  const start = course.learningStartISO ? new Date(course.learningStartISO) : new Date();
  let anchor = nextStudyAnchor(start, course.studyDaysMask);

  const chunks: StudyDayChunk[] = [];
  let idx = 0;
  let i = 0;
  while (i < lessons.length && chunks.length < targetDays) {
    const chunkIds: string[] = [];
    let used = 0;
    while (i < lessons.length && used + lessons[i].minutesEstimate <= minuteCap) {
      chunkIds.push(lessons[i].id);
      used += lessons[i].minutesEstimate;
      i++;
    }
    while (chunkIds.length === 0 && i < lessons.length) {
      chunkIds.push(lessons[i].id);
      used += lessons[i].minutesEstimate;
      i++;
    }

    chunks.push({
      id: crypto.randomUUID(),
      index: idx++,
      dateISO: dateStamp(anchor),
      deadlineISO: endOfLocalDay(anchor),
      lessonIds: chunkIds,
      renewedByDays: 0
    });
    anchor = advanceStudyDay(anchor, course.studyDaysMask);
  }

  // If we still have lessons left (edge case: many huge lessons), spill them into the last day.
  if (i < lessons.length && chunks.length) {
    const last = chunks[chunks.length - 1];
    const extra: string[] = [];
    while (i < lessons.length) {
      extra.push(lessons[i].id);
      i++;
    }
    chunks[chunks.length - 1] = { ...last, lessonIds: [...last.lessonIds, ...extra] };
  }

  return { ...course, scheduleChunks: chunks };
}

/** Shift deadline for overdue plans (Coursera-style renewal) — adds days from "today" baseline */
export function renewChunkDeadline(course: TutorCourse, chunkId: string, extensionDays = 7): TutorCourse {
  const chunks = course.scheduleChunks.map((c) => {
    if (c.id !== chunkId) return c;
    const base = new Date(c.deadlineISO);
    base.setDate(base.getDate() + extensionDays);
    const deadline = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999).toISOString();
    return {
      ...c,
      deadlineISO: deadline,
      renewedByDays: c.renewedByDays + extensionDays
    };
  });
  return { ...course, scheduleChunks: chunks };
}
