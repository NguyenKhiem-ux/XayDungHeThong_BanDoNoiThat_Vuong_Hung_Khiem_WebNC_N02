import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { SaveReviewDto, ListReviewsDto } from './review.dto';
import { reviewSummaries } from './reviews.service';

test('review DTO accepts only 1–5 integer stars and rejects spoofed buyer/order IDs', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const check = (body: unknown) => pipe.transform(body, { type: 'body', metatype: SaveReviewDto });
  assert.equal((await check({ rating: 4, comment: 'Tốt' })).rating, 4);
  for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 3.5 }, { rating: '5' }, { rating: 5, userId: 1 }, { rating: 5, orderId: 1 }, { rating: 5, comment: 'a'.repeat(2001) }]) await assert.rejects(check(body));
  assert.equal((await pipe.transform({}, { type: 'query', metatype: ListReviewsDto })).page, 1);
  await assert.rejects(pipe.transform({ rating: '6' }, { type: 'query', metatype: ListReviewsDto }));
  await assert.rejects(pipe.transform({ page: '0' }, { type: 'query', metatype: ListReviewsDto }));
});

test('review summaries use database counts, convert numeric strings and keep unrated products at zero', async () => {
  let queries = 0;
  const query: any = { select: () => query, addSelect: () => query, where: () => query, groupBy: () => query,
    getRawMany: async () => { queries++; return [{ productId: '1', reviewCount: '3', averageRating: '4.33333', stars1: '0', stars2: '0', stars3: '0', stars4: '2', stars5: '1' }]; } };
  const manager: any = { getRepository: () => ({ createQueryBuilder: () => query }) };
  const summaries = await reviewSummaries(manager, [1, 2]);
  assert.deepEqual(summaries.get(1), { averageRating: 4.3, reviewCount: 3, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } });
  assert.deepEqual(summaries.get(2), { averageRating: 0, reviewCount: 0, ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  await reviewSummaries(manager, []); assert.equal(queries, 1);
});

test('review migration is repeatable and never updates/deletes existing orders or customer data', async () => {
  const { upgradeReviews } = require('../../scripts/setup-reviews.cjs');
  const statements: string[] = [];
  const connection = { query: async (sql: string) => {
    statements.push(sql);
    if (sql === 'SHOW COLUMNS FROM product_reviews') return [['id', 'product_id', 'user_id', 'order_id', 'rating', 'comment', 'created_at', 'updated_at'].map(Field => ({ Field }))];
    if (sql === 'SHOW INDEX FROM product_reviews') return [[{ Key_name: 'UQ_review_buyer_product', Non_unique: 0, Column_name: 'user_id' }, { Key_name: 'UQ_review_buyer_product', Non_unique: 0, Column_name: 'product_id' }]];
    return [[]];
  } };
  await upgradeReviews(connection); await upgradeReviews(connection);
  assert.ok(!statements.some(sql => /^\s*(DELETE|UPDATE|DROP|TRUNCATE)\b/i.test(sql)));
  assert.match(statements[0], /CHECK \(rating BETWEEN 1 AND 5\)/);
});
