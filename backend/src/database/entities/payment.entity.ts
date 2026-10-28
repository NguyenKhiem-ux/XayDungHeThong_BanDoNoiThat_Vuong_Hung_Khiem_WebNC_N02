// file định nghĩa entity payment và ánh xạ dữ liệu của entity này với bảng trong database.
import { Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentMethod, PaymentRecordStatus } from './enums';
import { Order } from './order.entity';

@Entity('payments')
@Index('UQ_payment_payos_link', ['payosLinkId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'order_id', type: 'bigint', unique: true })
  orderId: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'decimal', precision: 15, scale: 0 })
  amount: string;

  @Column({ type: 'enum', enum: PaymentRecordStatus, default: PaymentRecordStatus.PENDING })
  status: PaymentRecordStatus;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'payos_link_id', type: 'varchar', length: 64, nullable: true })
  payosLinkId: string | null;

  @Column({ name: 'payos_checkout_url', type: 'varchar', length: 500, nullable: true })
  payosCheckoutUrl: string | null;

  @Column({ name: 'payos_lease_until', type: 'datetime', precision: 6, nullable: true })
  payosLeaseUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
