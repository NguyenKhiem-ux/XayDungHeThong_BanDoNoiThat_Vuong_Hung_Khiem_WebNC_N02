import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { CheckoutSnapshot } from '../../orders/checkout.types';

@Entity('checkout_records')
@Index('IDX_checkout_user', ['userId'])
@Index('UQ_checkout_order', ['orderId'], { unique: true })
export class CheckoutRecord {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ name: 'user_id', type: 'bigint' }) userId: number;
  @Column({ type: 'json' }) snapshot: CheckoutSnapshot;
  @Column({ type: 'char', length: 64 }) hash: string;
  @Column({ type: 'varchar', length: 16, default: 'ready' }) state: 'ready' | 'created' | 'cancelled';
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId: number | null;
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 }) expiresAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt: Date;
}
