import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProductReview } from '../database/entities/product-review.entity';
import { Product } from '../database/entities/product.entity';
import { Order } from '../database/entities/order.entity';
import { OrderStatus, PaymentStatus } from '../database/entities/enums';
import { ListReviewsDto, SaveReviewDto } from './review.dto';

export interface ReviewSummary { averageRating: number; reviewCount: number; ratingCounts: Record<number, number> }

export function emptyReviewSummary(): ReviewSummary {
  return { averageRating: 0, reviewCount: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
}

// Batch aggregation keeps product grids and promotion cards free of per-product review queries.
export async function reviewSummaries(manager: EntityManager, productIds: number[]) {
  const summaries = new Map(productIds.map(id => [Number(id), emptyReviewSummary()]));
  if (!productIds.length) return summaries;
  const query = manager.getRepository(ProductReview).createQueryBuilder('review').select('review.productId', 'productId')
    .addSelect('COUNT(*)', 'reviewCount').addSelect('AVG(review.rating)', 'averageRating')
    .where('review.productId IN (:...productIds)', { productIds }).groupBy('review.productId');
  for (const rating of [1, 2, 3, 4, 5]) query.addSelect(`SUM(CASE WHEN review.rating = ${rating} THEN 1 ELSE 0 END)`, `stars${rating}`);
  for (const row of await query.getRawMany()) summaries.set(Number(row.productId), {
    averageRating: Math.round(Number(row.averageRating) * 10) / 10, reviewCount: Number(row.reviewCount),
    ratingCounts: Object.fromEntries([1, 2, 3, 4, 5].map(rating => [rating, Number(row[`stars${rating}`])])),
  });
  return summaries;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly dataSource: DataSource) {}

  private purchase(manager: EntityManager, userId: number, productId: number) {
    const query = manager.getRepository(Order).createQueryBuilder('purchase').select(['purchase.id'])
      .innerJoin('purchase.items', 'line', 'line.productId = :productId', { productId })
      .where('purchase.userId = :userId', { userId }).andWhere('purchase.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('purchase.paymentStatus = :paid', { paid: PaymentStatus.PAID }).orderBy('purchase.id', 'DESC');
    if (manager.queryRunner?.isTransactionActive) query.setLock('pessimistic_read');
    return query.getOne();
  }

  async list(productId: number, query: ListReviewsDto) {
    const repo = this.dataSource.getRepository(ProductReview);
    if (!await this.dataSource.getRepository(Product).existsBy({ id: productId })) throw new NotFoundException('Không tìm thấy sản phẩm.');
    const [summary, [reviews, total]] = await Promise.all([
      reviewSummaries(this.dataSource.manager, [productId]),
      repo.findAndCount({ where: { productId, ...(query.rating ? { rating: query.rating } : {}) }, relations: ['user'],
        select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true, user: { fullName: true } },
        order: { updatedAt: 'DESC', id: 'DESC' }, skip: (query.page - 1) * 10, take: 10 }),
    ]);
    return { summary: summary.get(productId)!, reviews: reviews.map(review => ({ id: review.id, rating: review.rating, comment: review.comment,
      createdAt: review.createdAt, updatedAt: review.updatedAt, author: `${Array.from(review.user?.fullName?.trim().split(/\s+/).at(-1) || 'K')[0]}***` })),
      total, page: query.page, pageSize: 10 };
  }

  async mine(userId: number, productId: number) {
    const [purchase, review] = await Promise.all([this.purchase(this.dataSource.manager, userId, productId),
      this.dataSource.getRepository(ProductReview).findOneBy({ userId, productId })]);
    return { canReview: !!purchase, review: review ? { rating: review.rating, comment: review.comment } : null };
  }

  async save(userId: number, productId: number, dto: SaveReviewDto) {
    await this.dataSource.transaction(async manager => {
      const product = await manager.getRepository(Product).findOne({ where: { id: productId }, lock: { mode: 'pessimistic_read' } });
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');
      const purchase = await this.purchase(manager, userId, productId);
      if (!purchase) throw new ForbiddenException('Bạn chỉ có thể đánh giá sản phẩm trong đơn đã giao và thanh toán của mình.');
      // The database unique key makes retries/edits one review, including concurrent requests.
      await manager.getRepository(ProductReview).upsert({ userId, productId, orderId: purchase.id, rating: dto.rating, comment: dto.comment?.trim() ?? '' }, ['userId', 'productId']);
    });
    return { ...(await this.mine(userId, productId)), summary: (await reviewSummaries(this.dataSource.manager, [productId])).get(productId)! };
  }
}
