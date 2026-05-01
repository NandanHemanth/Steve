export const storageKeys = {
  groqKeys: "steve.groqKeys",
  huggingface: "steve.huggingface",
  aiProvider: "steve.aiProvider",
  profile: "steve.profile",
  coursePlanner: "steve.coursePlanner",
  aiCoursePlan: "steve.aiCoursePlan",
  careerFit: "steve.careerFit"
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

