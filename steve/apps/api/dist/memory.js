const MAX_MESSAGES = 40;
const store = new Map();
export function getUserMemory(userId) {
    const existing = store.get(userId);
    if (existing)
        return existing;
    const fresh = { messages: [], updatedAt: Date.now() };
    store.set(userId, fresh);
    return fresh;
}
export function appendUserMessages(userId, newMsgs) {
    const mem = getUserMemory(userId);
    mem.messages.push(...newMsgs);
    mem.updatedAt = Date.now();
    if (mem.messages.length > MAX_MESSAGES) {
        mem.messages.splice(0, mem.messages.length - MAX_MESSAGES);
    }
}
export function clearUserMemory(userId) {
    store.delete(userId);
}
