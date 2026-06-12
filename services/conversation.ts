import request from "./request";

export interface Conversation {
  id: number;
  userId: number;
  title: string;
  summary: string | null;
  summarizedMessageId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  thinking: string | null;
  fromCache: boolean;
  createdAt: string;
}

/** 获取当前用户会话列表（按 updatedAt 降序） */
export function getConversations() {
  return request.get<Conversation[]>("/conversations");
}

/** 新建空会话 */
export function createConversation() {
  return request.post<Conversation>("/conversations");
}

/** 重命名会话 */
export function updateConversation(id: number, data: { title: string }) {
  return request.patch<Conversation>(`/conversations/${id}`, data);
}

/** 删除会话（级联删除消息） */
export function deleteConversation(id: number) {
  return request.delete(`/conversations/${id}`);
}

export interface MessagesPageResult {
  items: ConversationMessage[];
  hasMore: boolean;
  total: number;
}

export interface GetMessagesParams {
  limit?: number;
  beforeId?: number;
}

/** 分页获取会话历史消息 */
export function getConversationMessages(
  conversationId: number,
  params?: GetMessagesParams
) {
  return request.get<MessagesPageResult>(
    `/conversations/${conversationId}/messages`,
    { params }
  );
}
