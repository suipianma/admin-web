import request from "./request";

export type MemoryScope = "USER" | "CONVERSATION" | "GLOBAL";

export type MemoryType =
  | "MESSAGE"
  | "SUMMARY"
  | "PROMPT"
  | "POLICY"
  | "RAG"
  | "PROFILE"
  | "PREFERENCE"
  | "FACT"
  | "OTHER";

export interface Memory {
  id: number;
  ownerUserId: number;
  scope: MemoryScope;
  type: MemoryType;
  category: string;
  content: string;
  sourceConversationId: number | null;
  sourceMessageId: number | null;
  importance: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchMemoryParams {
  query?: string;
  scope?: MemoryScope;
  type?: MemoryType;
  category?: string;
  limit?: number;
  conversationId?: number;
}

export interface CreateMemoryParams {
  scope: MemoryScope;
  type: MemoryType;
  category: string;
  content: string;
  importance?: number;
  expiresAt?: string;
  sourceConversationId?: number;
  sourceMessageId?: number;
  ownerUserId?: number;
}

export function getMemories(params?: SearchMemoryParams) {
  return request.get<Memory[]>("/memories", { params });
}

export function createMemory(data: CreateMemoryParams) {
  return request.post<Memory>("/memories", data);
}

export function forgetMemory(id: number) {
  return request.delete<Memory>(`/memories/${id}`);
}
