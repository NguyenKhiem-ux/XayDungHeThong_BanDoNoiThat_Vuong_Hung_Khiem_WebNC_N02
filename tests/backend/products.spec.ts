import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { entities } from '../../backend/src/database/entities';
import { Product } from '../../backend/src/database/entities/product.entity';
import { ListProductsDto } from '../../backend/src/products/dto/list-products.dto';
import { ProductsService } from '../../backend/src/products/products.service';
import { salePrice } from '../../backend/src/promotions/promotion-price';

test('QA-B04 catalog search builds parameterized MySQL for hostile keyword/category without connecting', async () => {
  const source = new DataSource({ type: 'mysql', database: 'qa_metadata_only', entities });
  await (source as any).buildMetadatas();
  const repository = source.getRepository(Product);
  const create = repository.createQueryBuilder.bind(repository);
  const statements: Array<[string, any[]]> = [];
  repository.createQueryBuilder = (...args: any[]) => {
    const query = create(...args);
    query.getMany = async () => { statements.push(query.getQueryAndParameters()); return []; };
    return query;
  };
  const service = new ProductsService(repository, { prices: async () => new Map() } as never);
  const hostile = "' OR 1=1 --";
  assert.deepEqual(await service.list({ keyword: hostile, category: hostile }), []);
  assert.equal(statements.length, 1);
  const [sql, parameters] = statements[0];
  assert.equal(sql.includes(hostile), false); assert.match(sql, /LIKE \?/); assert.match(sql, /category.*= \?/);
  assert.ok(parameters.includes('%' + hostile.toLowerCase() + '%')); assert.ok(parameters.includes(hostile));
  await service.list({ keyword: '   ', category: ' ' });
  assert.equal(statements[1][1].length, 0);
});

test('QA-B05 product detail rejects missing IDs and serializes price, stock, promotion and review summary', async () => {
  const query: any = { select: () => query, addSelect: () => query, where: () => query, groupBy: () => query,
    getRawMany: async () => [] };
  const product = { id: 10, name: 'QA Kettle', price: '500000', stock: 2, isFeatured: 1 };
  const repository = { findOne: async ({ where }: any) => where.id === 10 ? product : null,
    manager: { getRepository: () => ({ createQueryBuilder: () => query }) } };
  const service = new ProductsService(repository as never, { prices: async () => new Map([[10,
    { price: 300000, originalPrice: 500000, discountPercent: 40, savings: 200000 }]]) } as never);
  await assert.rejects(service.findOne(999), NotFoundException);
  const result = await service.findOne(10);
  assert.equal(result.price, 300000); assert.equal(result.stock, 2); assert.equal(result.originalPrice, 500000);
  assert.equal(result.reviewCount, 0); assert.equal(result.isFeatured, true);
});

test('QA-B06 paginated catalog filters and sorts by the selling price in SQL and returns { items, total }', async () => {
  const source = new DataSource({ type: 'mysql', database: 'qa_metadata_only', entities });
  await (source as any).buildMetadatas();
  const repository = source.getRepository(Product);
  const create = repository.createQueryBuilder.bind(repository);
  const statements: Array<[string, any[]]> = [];
  repository.createQueryBuilder = (...args: any[]) => {
    const query = create(...args);
    query.getManyAndCount = async () => { statements.push(query.getQueryAndParameters()); return [[], 30]; };
    return query;
  };
  const service = new ProductsService(repository, { activeId: async () => 5, prices: async () => new Map() } as never);
  (service as any).vietnameseCollation = Promise.resolve(true);

  const result: any = await service.list({ keyword: 'nồi', page: 3, limit: 12, sort: 'price-desc', minPrice: 5_000_000, maxPrice: 15_000_000 });
  assert.equal(result.total, 30); assert.equal(result.page, 3); assert.equal(result.limit, 12); assert.deepEqual(result.items, []);
  const [sql, parameters] = statements[0];
  const plain = sql.replace(/`/g, '');
  assert.match(plain, /LEFT JOIN promotion_items pi ON pi\.product_id = p\.id AND pi\.promotion_id = \?/);
  assert.match(plain, /FLOOR\(\(p\.price \* \(100 - pi\.discount_percent\) \+ 50\) \/ 100\) END >= \?/);
  assert.match(sql, /ORDER BY effective_price DESC, `p`\.`id` DESC LIMIT 12 OFFSET 24/);
  assert.deepEqual(parameters.filter(v => typeof v === 'number'), [5, 5_000_000, 15_000_000]);

  await service.list({ page: 1, sort: 'name' });
  assert.match(statements[1][0].replace(/`/g, ''), /ORDER BY p\.name COLLATE utf8mb4_vi_0900_ai_ci ASC, p\.id DESC LIMIT 12/);
  // Công thức SQL phải trùng salePrice() để giá lọc khớp giá hiển thị.
  for (const [price, percent] of [[1_590_000, 15], [999, 33], [123_456_789, 99]]) assert.equal(Math.floor((price * (100 - percent) + 50) / 100), salePrice(price, percent));
});

test('QA-B07 product list query rejects oversized pages, unknown sorts and untrusted fields', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const check = (value: unknown) => pipe.transform(value, { type: 'query', metatype: ListProductsDto });
  const ok = await check({ page: '2', limit: '12', sort: 'price-asc', minPrice: '0', maxPrice: '5000000' });
  assert.equal(ok.page, 2); assert.equal(ok.maxPrice, 5_000_000);
  for (const bad of [{ page: '0' }, { limit: '49' }, { sort: 'price' }, { minPrice: '-1' }, { page: '1.5' }, { role: 'ADMIN' }]) await assert.rejects(check(bad), JSON.stringify(bad));
});
