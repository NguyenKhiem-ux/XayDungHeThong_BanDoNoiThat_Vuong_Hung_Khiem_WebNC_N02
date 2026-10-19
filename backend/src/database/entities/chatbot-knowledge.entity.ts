import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum KnowledgeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  // Retain older rows during TypeORM schema sync; the API presents this as pending.
  LEGACY_PENDING_REVIEW = 'pending_review',
}

@Entity('chatbot_knowledge')
@Index('uq_chatbot_question_context', ['questionKey', 'contextHash'], { unique: true })
@Index('idx_chatbot_status', ['status'])
export class ChatbotKnowledge {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ length: 1000 })
  question: string;

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
