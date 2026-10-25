import { api } from './client';
import type { ChatbotKnowledge, ChatbotStats, ChatIntent, KnowledgeStatus, RiskLevel } from './types';

export type KnowledgeInput = Pick<ChatbotKnowledge, 'question' | 'answer' | 'keywords'>;
const path = '/admin/chatbot/knowledge';

export const knowledgeApi = {
  list: (status: KnowledgeStatus | '', page: number, risk: RiskLevel | '', intent: ChatIntent | '') =>
    api.get<{ items: ChatbotKnowledge[]; total: number; page: number; limit: number }>(path, {
      params: { status: status || undefined, page, limit: 20, risk: risk || undefined, intent: intent || undefined },
    }),
  detail: (id: number) => api.get<ChatbotKnowledge>(`${path}/${id}`),
  create: (data: KnowledgeInput) => api.post<ChatbotKnowledge>(path, data),
  update: (id: number, data: KnowledgeInput) => api.patch<ChatbotKnowledge>(`${path}/${id}`, data),
  approve: (id: number) => api.patch<ChatbotKnowledge>(`${path}/${id}/approve`),
  reject: (id: number) => api.patch<ChatbotKnowledge>(`${path}/${id}/reject`),
  remove: (id: number) => api.delete(`${path}/${id}`),
  stats: () => api.get<ChatbotStats>('/admin/chatbot/stats'),
};
