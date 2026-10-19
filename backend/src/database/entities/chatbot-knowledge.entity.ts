import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ChatIntent, RiskLevel } from '../../chat/chat.types';

export enum KnowledgeStatus {
  PENDING = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  // Retain older rows during TypeORM schema sync; the API presents this as pending.
  LEGACY_PENDING_REVIEW = 'pending_review',
}

// Explicit additive migration owns this table, not global synchronize (which would damage legacy enum values).
@Entity({ name: 'chatbot_knowledge', synchronize: false })
@Index('uq_chatbot_question_context', ['questionKey', 'contextHash'], { unique: true })
@Index('idx_chatbot_status', ['status'])
export class ChatbotKnowledge {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ length: 1000 })
  question: string;

  @Column({ name: 'normalized_question', length: 1000 })
  normalizedQuestion: string;

  @Column({ length: 40, default: 'unknown' })
  intent: ChatIntent;

  @Column({ name: 'confidence_score', type: 'tinyint', unsigned: true, default: 0 })
  confidenceScore: number;

  @Column({ name: 'risk_level', type: 'enum', enum: RiskLevel, default: RiskLevel.HIGH })
  riskLevel: RiskLevel;

  @Column({ type: 'enum', enum: ['gemini', 'admin', 'system'], default: 'system' })
  source: 'gemini' | 'admin' | 'system';

  @Column({ name: 'should_store', default: true })
  shouldStore: boolean;

  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true })
  reviewedBy: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text' })
  answer: string;

  @Column({ length: 1000, default: '' })
  keywords: string;

  @Column({ name: 'question_key', type: 'char', length: 64 })
  questionKey: string;

  // Empty for general FAQ; a hash of current product facts for product answers.
  @Column({ name: 'context_hash', type: 'varchar', length: 64, default: '' })
  contextHash: string;

  @Column({ type: 'enum', enum: KnowledgeStatus, default: KnowledgeStatus.PENDING })
  status: KnowledgeStatus;

  @Column({ name: 'usage_count', type: 'int', unsigned: true, default: 0 })
  usageCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
