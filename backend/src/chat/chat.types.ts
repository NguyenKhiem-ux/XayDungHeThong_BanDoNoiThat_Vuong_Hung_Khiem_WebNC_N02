export const CHAT_INTENTS = [
  'small_talk', 'greeting', 'thanks', 'goodbye',
  'product_search', 'product_detail', 'product_recommendation', 'product_comparison',
  'product_price', 'product_stock', 'product_category',
  'shipping', 'payment', 'promotion', 'warranty', 'return', 'refund', 'order',
  'complaint', 'account', 'password', 'legal', 'general_store_question', 'general_question', 'unknown',
] as const;
export type ChatIntent = typeof CHAT_INTENTS[number];
export enum RiskLevel { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
export interface Classification {
  intent: ChatIntent;
  riskLevel: RiskLevel;
  shouldStore: boolean;
}
export interface GeminiDraft {
  answer: string;
  intent: ChatIntent;
  confidence_score: number;
  risk_level: RiskLevel;
  should_auto_approve: boolean;
}

export interface RagContext {
  question: string;
  answer: string;
  intent: ChatIntent;
}
