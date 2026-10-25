import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../database/entities/favorite.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    private readonly products: ProductsService,
  ) {}

  async list(userId: number) {
    const favorites = await this.favorites.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
    return Promise.all(favorites.map((favorite) => this.serialize(favorite)));
  }

  async add(userId: number, productId: number) {
    await this.products.findOne(productId);
    await this.favorites.upsert({ userId, productId }, ['userId', 'productId']);
    const favorite = await this.favorites.findOne({ where: { userId, productId }, relations: ['product'] });
    if (!favorite) throw new NotFoundException('Khong tim thay san pham');
    return this.serialize(favorite);
  }

  async remove(userId: number, productId: number) {
    await this.favorites.delete({ userId, productId });
    return { message: 'Da xoa san pham khoi danh sach yeu thich' };
  }

  private async serialize(favorite: Favorite) {
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt,
      product: await this.products.publicProduct(favorite.product),
    };
  }
}
