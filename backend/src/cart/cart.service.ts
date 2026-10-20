// file chứa logic xử lý nghiệp vụ của chức năng cart và làm việc với database khi cần.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cart } from '../database/entities/cart.entity';
import { CartItem } from '../database/entities/cart-item.entity';
import { Product } from '../database/entities/product.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
  ) {}

  async get(userId: number) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.items.find({ where: { cartId: cart.id }, relations: ['product'], order: { id: 'ASC' } });
    return this.serialize(cart, items);
  }

  async add(userId: number, productId: number, quantity = 1) {
    this.validate(productId, quantity);
    await this.change(userId, async (manager, cart) => {
      const product = await manager.getRepository(Product).findOne({ where: { id: productId }, lock: { mode: 'pessimistic_read' } });
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
      if (product.stock <= 0) throw new BadRequestException('Sản phẩm đã hết hàng');
      const items = manager.getRepository(CartItem);
      let item = await items.findOne({ where: { cartId: cart.id, productId } });
      const nextQuantity = (item?.quantity ?? 0) + quantity;
      if (nextQuantity > product.stock) throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
      if (item) item.quantity = nextQuantity;
      else item = items.create({ cartId: cart.id, productId, quantity });
      await items.save(item);
    });
    return this.get(userId);
  }

  async update(userId: number, productId: number, quantity: number) {
    this.validate(productId, quantity);
    await this.change(userId, async (manager, cart) => {
      const product = await manager.getRepository(Product).findOne({ where: { id: productId }, lock: { mode: 'pessimistic_read' } });
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
      if (quantity > product.stock) throw new BadRequestException(`Chỉ còn ${product.stock} sản phẩm trong kho`);
      const items = manager.getRepository(CartItem);
      const item = await items.findOne({ where: { cartId: cart.id, productId } });
      if (!item) throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
      item.quantity = quantity;
      await items.save(item);
    });
    return this.get(userId);
  }

  async remove(userId: number, productId: number) {
    this.validate(productId, 1);
    await this.change(userId, async (manager, cart) => {
      await manager.getRepository(CartItem).delete({ cartId: cart.id, productId });
    });
    return this.get(userId);
  }

  async clear(userId: number) {
    await this.change(userId, async (manager, cart) => {
      await manager.getRepository(CartItem).delete({ cartId: cart.id });
    });
    return this.get(userId);
  }

  async getOrCreateCart(userId: number) {
    let cart = await this.carts.findOne({ where: { userId } });
    if (!cart) {
      try { cart = await this.carts.save(this.carts.create({ userId })); } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
        cart = await this.carts.findOneByOrFail({ userId });
      }
    }
    return cart;
  }

  private validate(productId: number, quantity: number) {
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Sản phẩm hoặc số lượng không hợp lệ');
    }
  }

  private async change(userId: number, work: (manager: EntityManager, cart: Cart) => Promise<void>) {
    const cart = await this.getOrCreateCart(userId);
    await this.carts.manager.transaction(async manager => {
      const locked = await manager.getRepository(Cart).findOneOrFail({ where: { id: cart.id, userId }, lock: { mode: 'pessimistic_write' } });
      await work(manager, locked);
    });
  }

  private serialize(cart: Cart, items: CartItem[]) {
    const serializedItems = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        stock: item.product.stock,
        imageUrl: item.product.imageUrl,
        category: item.product.category,
        brand: item.product.brand,
      },
      subtotal: Number(item.product.price) * item.quantity,
    }));
    return {
      id: cart.id,
      items: serializedItems,
      itemCount: serializedItems.reduce((sum, item) => sum + item.quantity, 0),
      total: serializedItems.reduce((sum, item) => sum + item.subtotal, 0),
    };
  }
}
