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
    return this.addMany(userId, [{ productId, quantity }]);
  }

  async addMany(userId: number, lines: Array<{ productId: number; quantity: number }>) {
    return this.changeMany(userId, lines, false);
  }

  async setMany(userId: number, lines: Array<{ productId: number; quantity: number }>) {
    return this.changeMany(userId, lines, true);
  }

  private async changeMany(userId: number, lines: Array<{ productId: number; quantity: number }>, replace: boolean) {
    if (!Array.isArray(lines) || !lines.length || lines.length > 20) throw new BadRequestException('Cần từ 1 đến 20 sản phẩm');
    const quantities = new Map<number, number>();
    for (const line of lines) {
      this.validate(line.productId, line.quantity);
      const quantity = (quantities.get(line.productId) ?? 0) + line.quantity;
      if (!Number.isSafeInteger(quantity)) throw new BadRequestException('Số lượng quá lớn');
      quantities.set(line.productId, quantity);
    }
    await this.change(userId, async (manager, cart) => {
      const items = manager.getRepository(CartItem);
      const pending: CartItem[] = [];
      // Lock products in a stable order and validate the whole batch before writing any line.
      for (const [productId, quantity] of [...quantities].sort(([a], [b]) => a - b)) {
        const product = await manager.getRepository(Product).findOne({ where: { id: productId }, lock: { mode: 'pessimistic_read' } });
        if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
        if (product.stock <= 0) throw new BadRequestException(`${product.name} đã hết hàng`);
        const item = await items.findOne({ where: { cartId: cart.id, productId } });
        const nextQuantity = (replace ? 0 : item?.quantity ?? 0) + quantity;
        if (nextQuantity > product.stock) throw new BadRequestException(`${product.name}: chỉ còn ${product.stock} sản phẩm trong kho`);
        pending.push(item ? Object.assign(item, { quantity: nextQuantity }) : items.create({ cartId: cart.id, productId, quantity: nextQuantity }));
      }
      for (const item of pending) await items.save(item);
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

  async clear(userId: number, expected?: Array<{ productId: number; quantity: number }>) {
    await this.change(userId, async (manager, cart) => {
      if (expected) {
        const rows = await manager.getRepository(CartItem).find({ where: { cartId: cart.id } });
        const signature = (items: Array<{ productId: number; quantity: number }>) => JSON.stringify(items.map(i => [i.productId, i.quantity]).sort(([a], [b]) => a - b));
        if (signature(rows) !== signature(expected)) throw new BadRequestException('Giỏ hàng đã thay đổi. Hãy xem lại và yêu cầu xóa lần nữa.');
      }
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
