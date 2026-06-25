import request from "./request";

export type KnowledgeBaseVisibility = "private" | "team" | "public";

export interface KnowledgeBase {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  visibility: KnowledgeBaseVisibility;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface DocumentItem {
  id: number;
  knowledgeBaseId: number;
  filename: string;
  mimeType: string;
  filePath: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface CreateKnowledgeBaseParams {
  name: string;
  description?: string;
  visibility?: KnowledgeBaseVisibility;
}

export interface UpdateKnowledgeBaseParams {
  name?: string;
  description?: string;
  visibility?: KnowledgeBaseVisibility;
}

export interface SearchResultChunk {
  chunkId: number;
  documentId: number;
  documentName: string;
  knowledgeBaseId: number;
  page?: number | null;
  content: string;
  score: number;
}

export interface SearchResultCitation {
  chunkId: number;
  documentName: string;
  page?: number | null;
  snippet: string;
  score: number;
}

export interface SearchKnowledgeBaseResult {
  chunks: SearchResultChunk[];
  citations: SearchResultCitation[];
}

export function getKnowledgeBases() {
  return request.get<KnowledgeBase[]>("/knowledge-bases");
}

export function getKnowledgeBase(id: number) {
  return request.get<KnowledgeBase>(`/knowledge-bases/${id}`);
}

export function createKnowledgeBase(data: CreateKnowledgeBaseParams) {
  return request.post<KnowledgeBase>("/knowledge-bases", data);
}

export function updateKnowledgeBase(id: number, data: UpdateKnowledgeBaseParams) {
  return request.patch<KnowledgeBase>(`/knowledge-bases/${id}`, data);
}

export function deleteKnowledgeBase(id: number) {
  return request.delete(`/knowledge-bases/${id}`);
}

export function getKnowledgeBaseDocuments(id: number) {
  return request.get<DocumentItem[]>(`/knowledge-bases/${id}/documents`);
}

export function uploadKnowledgeBaseDocument(id: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request.post<DocumentItem>(`/knowledge-bases/${id}/documents`, formData);
}

export function deleteKnowledgeBaseDocument(id: number, documentId: number) {
  return request.delete<DocumentItem>(`/knowledge-bases/${id}/documents`, {
    data: { documentId },
  });
}

export function searchKnowledgeBase(id: number, query: string) {
  return request.post<SearchKnowledgeBaseResult>(`/knowledge-bases/${id}/search`, {
    query,
  });
}

export function reindexKnowledgeBaseDocument(id: number, documentId: number) {
  return request.post<{ success: boolean }>(
    `/knowledge-bases/${id}/documents/${documentId}/reindex`,
  );
}
