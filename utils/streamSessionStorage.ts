const STORAGE_KEY = "chat:activeStream";

export interface ActiveStreamRecord {
  conversationId: number;
  streamId: string;
  updatedAt: number;
}

export function saveActiveStream(conversationId: number, streamId: string) {
  if (typeof window === "undefined") return;
  const record: ActiveStreamRecord = {
    conversationId,
    streamId,
    updatedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function loadActiveStream(): ActiveStreamRecord | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveStreamRecord;
    if (
      !parsed ||
      typeof parsed.conversationId !== "number" ||
      typeof parsed.streamId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveStream() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
