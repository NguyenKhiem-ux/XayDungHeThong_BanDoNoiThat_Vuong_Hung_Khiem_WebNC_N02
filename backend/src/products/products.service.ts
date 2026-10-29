// file chứa logic xử lý nghiệp vụ của chức năng products và làm việc với database khi cần.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { PromotionItem } from '../database/entities/promotion.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { reviewSummaries } from '../reviews/reviews.service';

export const DEFAULT_PAGE_SIZE = 12;
// Cùng công thức làm tròn với salePrice() trong promotions/promotion-price.ts; DECIMAL(15,0) nên MySQL tính chính xác.
const EFFECTIVE_PRICE = 'CASE WHEN pi.discount_percent IS NULL THEN p.price ELSE FLOOR((p.price * (100 - pi.discount_percent) + 50) / 100) END';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>, private readonly promotions: PromotionsService) {}

  async list(query: ListProductsDto = {}) {
    const qb = this.filtered(query);
    if (query.page === undefined) return this.publicProducts(await qb.orderBy('p.id', 'DESC').getMany());

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    // Giá lọc/sắp xếp là giá đang bán, nên ghép mức giảm của sự kiện đang chạy (mỗi sản phẩm tối đa một dòng nhờ UQ_promotion_product).
    qb.leftJoin(PromotionItem, 'pi', 'pi.product_id = p.id AND pi.promotion_id = :eventId', { eventId: await this.promotions.activeId() ?? 0 })
      .addSelect(EFFECTIVE_PRICE, 'effective_price');
    if (query.minPrice !== undefined) qb.andWhere(`${EFFECTIVE_PRICE} >= :minPrice`, { minPrice: query.minPrice });
    if (query.maxPrice !== undefined) qb.andWhere(`${EFFECTIVE_PRICE} <= :maxPrice`, { maxPrice: query.maxPrice });
    if (query.sort === 'price-asc' || query.sort === 'price-desc') qb.orderBy('effective_price', query.sort === 'price-asc' ? 'ASC' : 'DESC');
    else if (query.sort === 'name') qb.orderBy(await this.vietnameseNameOrder() ? 'p.name COLLATE utf8mb4_vi_0900_ai_ci' : 'p.name', 'ASC');
    // id là khóa phụ để thứ tự ổn định giữa các trang.
    qb.addOrderBy('p.id', 'DESC').offset((query.page - 1) * limit).limit(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items: await this.publicProducts(items), total, page: query.page, limit };
  }

  private vietnameseCollation?: Promise<boolean>;

  // Collation mặc định coi "ô" = "o" nên "Bộ" đứng trước "Bóng"; bản tiếng Việt chỉ có trên MySQL 8, MariaDB (XAMPP) thì không.
  private vietnameseNameOrder() {
    this.vietnameseCollation ??= this.products.manager.query("SHOW COLLATION LIKE 'utf8mb4_vi_0900_ai_ci'")
      .then((rows: unknown[]) => rows.length > 0, () => false);
    return this.vietnameseCollation;
  }

  private filtered(query: ListProductsDto) {
    const qb = this.products.createQueryBuilder('p');
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('LOWER(p.name) LIKE :keyword', { keyword })
            .orWhere('LOWER(COALESCE(p.brand, \'\')) LIKE :keyword', { keyword })
            .orWhere('LOWER(COALESCE(p.category, \'\')) LIKE :keyword', { keyword });
        }),
      );
    }
    if (query.category?.trim()) qb.andWhere('p.category = :category', { category: query.category.trim() });
    return qb;
  }

  async featured() {
    const items = await this.products.find({ where: { isFeatured: true }, order: { id: 'DESC' }, take: 8 });
    return this.publicProducts(items);
  }

  async findOne(id: number) {
    const item = await this.products.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy sản phẩm');
    return this.publicProduct(item);
  }

  async categories() {
    const rows = await this.products
      .createQueryBuilder('p')
      .select('p.category', 'category')
      .where('p.category IS NOT NULL')
      .andWhere("TRIM(p.category) <> ''")
      .groupBy('p.category')
      .orderBy('p.category', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((row) => row.category);
  }

  async create(dto: CreateProductDto, imageUrl?: string) {
    const product = this.products.create({
      name: dto.name,
      description: dto.description ?? null,
      specifications: dto.specifications ?? null,
      origin: dto.origin ?? null,
      price: String(dto.price),
      stock: dto.stock,
      category: dto.category ?? null,
      brand: dto.brand ?? null,
      imageUrl: imageUrl ?? dto.imageUrl ?? null,
      isFeatured: dto.isFeatured ?? false,
    });
    return this.publicProduct(await this.products.save(product));
  }

  async update(id: number, dto: UpdateProductDto, imageUrl?: string) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');

    Object.assign(product, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.specifications !== undefined ? { specifications: dto.specifications } : {}),
      ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
      ...(dto.price !== undefined ? { price: String(dto.price) } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    });
    return this.publicProduct(await this.products.save(product));
  }

  async remove(id: number) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    await this.products.remove(product);
    return { message: 'Đã xóa sản phẩm' };
  }

  async publicProducts(products: Product[]) {
    const [prices, reviews] = await Promise.all([this.promotions.prices(products), reviewSummaries(this.products.manager, products.map(product => Number(product.id)))]);
    return products.map(product => ({ ...product, ...prices.get(Number(product.id)), ...reviews.get(Number(product.id)), isFeatured: !!product.isFeatured }));
  }

  async publicProduct(product: Product) {
    const [prices, reviews] = await Promise.all([this.promotions.prices([product]), reviewSummaries(this.products.manager, [Number(product.id)])]);
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      specifications: product.specifications,
      origin: product.origin,
      price: Number(product.price),
      stock: product.stock,
      category: product.category,
      brand: product.brand,
      imageUrl: product.imageUrl,
      isFeatured: !!product.isFeatured,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      ...prices.get(Number(product.id)),
      ...reviews.get(Number(product.id)),
    };
  }
}
