// file chứa logic xử lý nghiệp vụ của chức năng products và làm việc với database khi cần.
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { reviewSummaries } from '../reviews/reviews.service';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>, private readonly promotions: PromotionsService) {}

  async list(query?: { keyword?: string; category?: string }) {
    const qb = this.products.createQueryBuilder('p').orderBy('p.id', 'DESC');
    if (query?.keyword?.trim()) {
      const keyword = `%${query.keyword.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('LOWER(p.name) LIKE :keyword', { keyword })
            .orWhere('LOWER(COALESCE(p.brand, \'\')) LIKE :keyword', { keyword })
            .orWhere('LOWER(COALESCE(p.category, \'\')) LIKE :keyword', { keyword });
        }),
      );
    }
    if (query?.category?.trim()) qb.andWhere('p.category = :category', { category: query.category.trim() });
    const items = await qb.getMany();
    return this.publicProducts(items);
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
