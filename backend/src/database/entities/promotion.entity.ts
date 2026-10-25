import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 120 }) title: string;
  @Column({ length: 300, default: '' }) description: string;
  @Column({ name: 'banner_discount_percent', type: 'tinyint', unsigned: true, nullable: true }) bannerDiscountPercent: number | null;
  @Column({ type: 'varchar', length: 12, default: 'draft' }) status: 'draft' | 'published' | 'paused';
  @Column({ name: 'starts_at', type: 'datetime' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'datetime' }) endsAt: Date;
  @OneToMany(() => PromotionItem, item => item.promotion) items: PromotionItem[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('promotion_items')
@Unique(['promotionId', 'productId'])
export class PromotionItem {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'promotion_id' }) promotionId: number;
  @Column({ name: 'product_id', type: 'bigint' }) productId: number;
  @Column({ name: 'discount_percent', type: 'int' }) discountPercent: number;
  @ManyToOne(() => Promotion, promotion => promotion.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' }) promotion: Promotion;
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' }) product: Product;
}
