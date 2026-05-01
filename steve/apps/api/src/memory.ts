export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  ts: number;
};

type UserMemory = {
  messages: ChatMessage[];
  updatedAt: number;
};

const MAX_MESSAGES = 40;

const store = new Map<string, UserMemory>();

export function getUserMemory(userId: string): UserMemory {
  const existing = store.get(userId);
  if (existing) return existing;
  const fresh: UserMemory = { messages: [], updatedAt: Date.now() };
  store.set(userId, fresh);
  return fresh;
}

export function appendUserMessages(userId: string, newMsgs: ChatMessage[]) {
  const mem = getUserMemory(userId);
  mem.messages.push(...newMsgs);
  mem.updatedAt = Date.now();

  if (mem.messages.length > MAX_MESSAGES) {
    mem.messages.splice(0, mem.messages.length - MAX_MESSAGES);
  }
}

export function clearUserMemory(userId: string) {
  store.delete(userId);
}

