import request from "./request";
import { streamChat, type StreamChatOptions } from "./ai";

export interface Conversation {
  id: number;
  userId: number;
  title: string;
  summary: string | null;
  summarizedMessageId: number | null;
  pinnedAt?: string | null;
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
  metadata?: {
    toolCalls?: import("@/components/chat/ChatMessageItem").ToolCallItem[];
    agentSteps?: import("@/components/chat/ChatMessageItem").AgentStepItem[];
    citations?: import("@/components/chat/ChatMessageItem").ChatMessage["citations"];
    feedback?: "up" | "down";
  } | null;
}

/** 获取当前用户会话列表（置顶优先，支持 q 搜索） */
export function getConversations(params?: { q?: string }) {
  return request.get<Conversation[]>("/conversations", { params });
}

/** 新建空会话 */
export function createConversation() {
  return request.post<Conversation>("/conversations");
}

/** 重命名会话 */
export function updateConversation(id: number, data: { title: string }) {
  return request.patch<Conversation>(`/conversations/${id}`, data);
}

/** 删除当前用户全部会话 */
export function deleteAllConversations() {
  return request.delete<{ deleted: number }>("/conversations/all");
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

export interface ActiveStreamSession {
  streamId: string;
  conversationId: number;
  status: "generating" | "completed" | "failed" | "interrupted";
  thinking: string;
  response: string;
  seq: number;
  fromCache: boolean;
  error?: string;
  done: boolean;
}

/** 置顶/取消置顶会话 */
export function setConversationPinned(id: number, pinned: boolean) {
  return request.patch<Conversation>(`/conversations/${id}/pin`, { pinned });
}

/** 导出会话 JSON */
export function exportConversation(id: number) {
  return request.get<Record<string, unknown>>(`/conversations/${id}/export`);
}

/** 设置助手消息反馈 */
export function setMessageFeedback(
  conversationId: number,
  messageId: number,
  feedback: "up" | "down" | null
) {
  return request.patch(`/conversations/${conversationId}/messages/${messageId}/feedback`, {
    feedback,
  });
}

/** 申请 SSE 一次性 stream ticket */
export function createStreamTicket(conversationId: number) {
  return request.post<{ ticket: string; expiresIn: number }>(
    `/conversations/${conversationId}/stream/ticket`
  );
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

/** 获取当前会话进行中的流式任务快照（用于刷新后恢复） */
export function getActiveStreamSession(conversationId: number) {
  return request.get<ActiveStreamSession | null>(
    `/conversations/${conversationId}/stream/active`
  );
}

/** 续传已有流式任务 */
export function resumeStreamChat(
  conversationId: number,
  resumeStreamId: string,
  options: Omit<StreamChatOptions, "content" | "resumeStreamId">
) {
  return streamChat(conversationId, undefined, {
    ...options,
    resumeStreamId,
  });
}

/** 停止进行中的流式生成 */
export function cancelStreamSession(conversationId: number, streamId: string) {
  return request.delete<{ ok: boolean }>(
    `/conversations/${conversationId}/stream`,
    { params: { streamId } }
  );
}

export interface ContextTraceResponse {
  requestId: string;
  traceId: string;
  conversationId: number;
  model: string;
  budget: {
    maxTokens: number;
    usedTokens: number;
    availableForContext: number;
  };
  selectedBlocks: Array<{ category: string; tokenCount: number }>;
  droppedBlocks: Array<{ category: string; tokenCount: number }>;
  trace: Array<{
    traceId: string;
    droppedCategories: string[];
    categoryTokenUsage: Record<string, number>;
  }>;
  stageTimings?: Record<string, number>;
  savedAt: number;
}

/** 获取单次请求的 Context Engine Trace */
export function getContextTrace(conversationId: number, requestId: string) {
  return request.get<ContextTraceResponse>(
    `/conversations/${conversationId}/traces/${requestId}`
  );
}
