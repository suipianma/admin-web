const LAST_CONVERSATION_KEY_PREFIX = "chat:lastConversation:";

function getStorageKey(userId: number) {
  return `${LAST_CONVERSATION_KEY_PREFIX}${userId}`;
}

/** 读取上次查看的会话 ID */
export function getLastConversationId(userId: number): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** 记录当前查看的会话 ID */
export function setLastConversationId(userId: number, conversationId: number) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(getStorageKey(userId), String(conversationId));
  } catch {
    // 存储失败不影响主流程
  }
}

/** 从会话列表中解析应恢复的 ID：优先上次查看，否则取列表第一条 */
export function resolveInitialConversationId(
  conversations: { id: number }[],
  userId: number | null
): number | null {
  if (conversations.length === 0) return null;

  if (userId != null) {
    const lastId = getLastConversationId(userId);
    if (lastId != null && conversations.some((c) => c.id === lastId)) {
      return lastId;
    }
  }

  return conversations[0].id;
}
