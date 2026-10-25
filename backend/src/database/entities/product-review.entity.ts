import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Product } from './product.entity';
import { User } from './user.entity';
import { Order } from './order.entity';

@Entity('product_reviews')
@Unique('UQ_review_buyer_product', ['userId', 'productId'])
export class ProductReview {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: number;
  @Column({ name: 'product_id', type: 'bigint' }) productId: number;
  @Column({ name: 'user_id', type: 'bigint' }) userId: number;
  @Column({ name: 'order_id', type: 'bigint' }) orderId: number;
  @Column({ type: 'tinyint', unsigned: true }) rating: number;
  @Column({ length: 2000, default: '' }) comment: string;
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' }) updatedAt: Date;
  @ManyToOne(() => Product, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'product_id' }) product: Product;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @ManyToOne(() => Order, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'order_id' }) order: Order;
}
