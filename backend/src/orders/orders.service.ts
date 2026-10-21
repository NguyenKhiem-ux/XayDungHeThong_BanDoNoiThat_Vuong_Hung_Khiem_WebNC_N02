// file chứa logic xử lý nghiệp vụ của chức năng orders và làm việc với database khi cần.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Cart } from '../database/entities/cart.entity';
import { CartItem } from '../database/entities/cart-item.entity';
import { OrderStatus, PaymentMethod, PaymentRecordStatus, PaymentStatus } from '../database/entities/enums';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Payment } from '../database/entities/payment.entity';
import { Product } from '../database/entities/product.entity';
import { User } from '../database/entities/user.entity';
import { Coupon, CouponDiscountType } from '../database/entities/coupon.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CheckoutRecord } from '../database/entities/checkout-record.entity';
import { UserAddress } from '../database/entities/user-address.entity';
import { CheckoutQuote, CheckoutSelection, CheckoutSnapshot } from './checkout.types';
import { evaluateCoupon } from '../coupon/coupons.service';
import { PromotionsService } from '../promotions/promotions.service';
 
@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly cartItems: Repository<CartItem>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly promotions: PromotionsService,
  ) {}
 
  async create(userId: number, dto: CreateOrderDto) {
    if (!dto.quoteId || !dto.quoteHash) throw new ConflictException('Hãy xem báo giá và xác nhận trước khi tạo đơn.');
    const result = await this.confirmCheckout(userId, dto.quoteId, dto.quoteHash);
    if (result.changed) throw new ConflictException({ message: 'Giá hoặc thông tin mua hàng đã thay đổi. Hãy xem và xác nhận lại báo giá mới.', quote: result.quote });
    return result.order!;
  }

  async previewCheckout(userId: number, selection: CheckoutSelection | CreateOrderDto, id?: string): Promise<CheckoutQuote> {
    return this.dataSource.transaction(async manager => {
      const records = manager.getRepository(CheckoutRecord);
      let record = id ? await records.findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } }) : null;
      if (id && !record) throw new NotFoundException('Không tìm thấy checkout của bạn.');
      if (record && (record.orderId || record.state !== 'ready' || record.expiresAt.getTime() < Date.now())) throw new ConflictException('Checkout đã hoàn tất, bị hủy hoặc hết hạn. Hãy bắt đầu checkout mới.');
      const { snapshot } = await this.calculate(manager, userId, selection);
      record = records.create({ ...record, id: record?.id ?? randomUUID(), userId, snapshot,
        hash: this.snapshotHash(snapshot), state: 'ready', orderId: null, expiresAt: new Date(Date.now() + 15 * 60_000) });
      await records.save(record);
      return this.quote(record);
    });
  }

  async confirmCheckout(userId: number, id: string, hash: string) {
    return this.dataSource.transaction(async manager => {
      // The persisted UUID is the idempotency key. Lock it before reading or consuming the cart.
      const records = manager.getRepository(CheckoutRecord);
      const record = await records.findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Không tìm thấy checkout của bạn.');
      if (hash !== record.hash) throw new ConflictException({ message: 'Nội dung checkout đã thay đổi. Hãy xem và xác nhận bản mới nhất.', quote: this.quote(record) });
      if (record.orderId) return { order: await this.getOneForUser(userId, record.orderId, manager.getRepository(Order)), changed: false };
      if (record.state !== 'ready' || record.expiresAt.getTime() < Date.now()) throw new ConflictException('Checkout đã bị hủy hoặc hết hạn. Hãy bắt đầu lại.');
      const selection: CheckoutSelection | CreateOrderDto = record.snapshot.address.id
        ? { addressId: record.snapshot.address.id, paymentMethod: record.snapshot.paymentMethod, couponCode: record.snapshot.couponCode ?? undefined }
        : { ...record.snapshot.address, email: record.snapshot.email, paymentMethod: record.snapshot.paymentMethod, couponCode: record.snapshot.couponCode ?? undefined, note: record.snapshot.note ?? undefined };
      const calculated = await this.calculate(manager, userId, selection);
      const currentHash = this.snapshotHash(calculated.snapshot);
      if (currentHash !== record.hash) {
        record.snapshot = calculated.snapshot; record.hash = currentHash;
        await records.save(record);
        return { quote: this.quote(record), changed: true };
      }
      const order = await this.writeOrder(manager, userId, calculated);
      record.orderId = order.id; record.state = 'created';
      await records.save(record);
      return { order, changed: false };
    });
  }

  async cancelCheckout(userId: number, id: string) {
    return this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(CheckoutRecord);
      const record = await repo.findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Không tìm thấy checkout của bạn.');
      if (record.orderId) throw new ConflictException(`Đơn #${record.orderId} đã được tạo. Hủy checkout không hủy đơn hàng này.`);
      record.state = 'cancelled'; await repo.save(record);
    });
  }

  private snapshotHash(snapshot: CheckoutSnapshot) { return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'); }
  private quote(record: CheckoutRecord): CheckoutQuote { return { ...record.snapshot, id: record.id, hash: record.hash, expiresAt: record.expiresAt.toISOString() }; }

  private async calculate(manager: EntityManager, userId: number, selection: CheckoutSelection | CreateOrderDto) {
    await this.promotions.lock(manager);
    if (!Object.values(PaymentMethod).includes(selection.paymentMethod)) throw new BadRequestException('Phương thức thanh toán không hợp lệ.');
    const cart = await manager.getRepository(Cart).findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });
    if (!cart) throw new BadRequestException('Giỏ hàng đang trống');
    const rows = await manager.getRepository(CartItem).find({ where: { cartId: cart.id }, order: { productId: 'ASC' } });
    if (!rows.length) throw new BadRequestException('Giỏ hàng đang trống');
    const products: Product[] = [];
    const items: CheckoutSnapshot['items'] = [];
    for (const row of rows) {
      if (!Number.isSafeInteger(row.quantity) || row.quantity < 1) throw new BadRequestException('Số lượng sản phẩm không hợp lệ.');
      const product = await manager.getRepository(Product).findOne({ where: { id: row.productId }, lock: { mode: 'pessimistic_write' } });
      if (!product) throw new NotFoundException('Sản phẩm không còn tồn tại.');
      if (product.stock < row.quantity) throw new BadRequestException(`${product.name}: không đủ tồn kho (còn ${product.stock}).`);
      products.push(product);
    }
    const prices = await this.promotions.prices(products, manager);
    for (const row of rows) {
      const product = products.find(product => Number(product.id) === Number(row.productId))!;
      const pricing = prices.get(Number(product.id))!;
      items.push({ productId: product.id, name: product.name, imageUrl: product.imageUrl, price: pricing.price, quantity: row.quantity,
        subtotal: pricing.price * row.quantity, originalPrice: pricing.originalPrice, promotionId: pricing.promotionId });
    }
    let address: CheckoutSnapshot['address'];
    let email: string;
    if ('addressId' in selection) {
      const owned = await manager.getRepository(UserAddress).findOne({ where: { id: selection.addressId, userId }, lock: { mode: 'pessimistic_read' } });
      if (!owned) throw new NotFoundException('Không tìm thấy địa chỉ thuộc tài khoản của bạn.');
      const user = await manager.getRepository(User).findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('Không tìm thấy tài khoản.');
      if (selection.paymentMethod === PaymentMethod.CARD && (!user.transactionPinHash || !user.cardHolder || !user.cardType || !user.cardProvider || !user.cardLast4 || !user.cardExpMonth || !user.cardExpYear)) throw new BadRequestException('Hãy lưu thẻ mô phỏng và tạo PIN trong hồ sơ trước, hoặc chọn phương thức khác. Không gửi PIN vào hội thoại.');
      address = { id: owned.id, fullName: owned.fullName, phone: owned.phone, address: owned.address }; email = user.email;
    } else { address = { fullName: selection.fullName, phone: selection.phone, address: selection.address }; email = selection.email; }
    if (!address.fullName?.trim() || address.fullName.length > 100 || !address.phone?.trim() || address.phone.length > 15 || !address.address?.trim() || !email?.trim() || email.length > 100) throw new BadRequestException('Thông tin người nhận chưa hợp lệ.');
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 999_999_999_999_999 || items.some(i => !Number.isSafeInteger(i.price) || i.price < 0)) throw new BadRequestException('Giá trị đơn hàng không hợp lệ.');
    let coupon: Coupon | null = null;
    let discountAmount = 0;
    if (selection.couponCode?.trim()) {
      const eligibleSubtotal = items.reduce((sum, item) => sum + (item.promotionId ? 0 : item.subtotal), 0);
      if (eligibleSubtotal <= 0) throw new BadRequestException('Mã giảm giá chỉ áp dụng cho sản phẩm không thuộc sự kiện ưu đãi. Hãy bỏ mã để tiếp tục.');
      coupon = await manager.getRepository(Coupon).findOne({ where: { code: selection.couponCode.trim().toUpperCase() }, lock: { mode: 'pessimistic_write' } });
      discountAmount = evaluateCoupon(coupon, eligibleSubtotal, userId).discountAmount;
    }
    const snapshot: CheckoutSnapshot = { items, address, email, paymentMethod: selection.paymentMethod, couponCode: coupon?.code ?? null,
      subtotal, discountAmount, shippingFee: 0, total: subtotal - discountAmount, note: 'note' in selection ? selection.note ?? null : null };
    if ([PaymentMethod.QR, PaymentMethod.PAYOS].includes(selection.paymentMethod) && snapshot.total <= 0) throw new BadRequestException('Tổng tiền bằng 0 không dùng PayOS. Hãy chọn tiền mặt.');
    return { snapshot, cart, products, coupon };
  }

  private async writeOrder(manager: EntityManager, userId: number, { snapshot, cart, products, coupon }: Awaited<ReturnType<OrdersService['calculate']>>) {
    for (const product of products) {
      product.stock -= snapshot.items.find(i => i.productId === product.id)!.quantity;
      await manager.save(Product, product);
    }
    const order = await manager.save(Order, manager.create(Order, { userId, fullName: snapshot.address.fullName, email: snapshot.email,
      phone: snapshot.address.phone, address: snapshot.address.address, totalAmount: String(snapshot.total), subtotalAmount: String(snapshot.subtotal), discountAmount: String(snapshot.discountAmount),
      couponCode: snapshot.couponCode, status: OrderStatus.PENDING, paymentMethod: snapshot.paymentMethod, paymentStatus: PaymentStatus.UNPAID, note: snapshot.note }));
    await manager.save(OrderItem, snapshot.items.map(item => manager.create(OrderItem, { orderId: order.id, productId: item.productId,
      productName: item.name, productImage: item.imageUrl, price: String(item.price), quantity: item.quantity, subtotal: String(item.subtotal) })));
    await manager.save(Payment, manager.create(Payment, { orderId: order.id, method: snapshot.paymentMethod, amount: String(snapshot.total), status: PaymentRecordStatus.PENDING,
      transactionId: null, paidAt: null, payosLinkId: null, payosCheckoutUrl: null, payosLeaseUntil: null }));
    if (coupon) { coupon.usedCount++; await manager.save(Coupon, coupon); }
    await manager.getRepository(CartItem).delete({ cartId: cart.id });
    return this.getOneForUser(userId, order.id, manager.getRepository(Order));
  }
 
  async listForUser(userId: number) {
    const orders = await this.orders.find({ where: { userId }, relations: ['items'], order: { createdAt: 'DESC' } });
    return orders.map((order) => this.serialize(order));
  }
 
  async getOneForUser(userId: number, id: number, repo = this.orders) {
    const order = await repo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
    return this.serialize(order);
  }
 
  async adminList() {
    const orders = await this.orders.find({ relations: ['items', 'user'], order: { createdAt: 'DESC' } });
    return orders.map((order) => ({ ...this.serialize(order), user: order.user ? { id: order.user.id, username: order.user.username } : null }));
  }
 
  async adminUpdateStatus(id: number, dto: UpdateOrderStatusDto) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const previousStatus = order.status;
    order.status = dto.status;
    if (dto.status === OrderStatus.DELIVERED && order.paymentMethod === PaymentMethod.CASH) {
      order.paymentStatus = PaymentStatus.PAID;
      const payment = await this.payments.findOne({ where: { orderId: order.id } });
      if (payment) {
        payment.status = PaymentRecordStatus.SUCCESS;
        payment.paidAt = new Date();
        await this.payments.save(payment);
      }
    }
    const saved = await this.orders.save(order);
    if (dto.status === OrderStatus.CONFIRMED && previousStatus !== OrderStatus.CONFIRMED) {
      await this.issueRewardCoupon(saved);
    }
    return this.serialize(saved);
  }

  private async issueRewardCoupon(order: Order) {
    const amount = Number(order.subtotalAmount || order.totalAmount);
    if (amount < 1_000_000) return;
    const discountValue = amount < 5_000_000
      ? 10 + Math.floor(Math.random() * 11)
      : 30 + Math.floor(Math.random() * 11);
    const code = `DON${order.id}`;
    const coupons = this.dataSource.getRepository(Coupon);
    if (await coupons.exists({ where: { code } })) return;
    const now = new Date();
    await coupons.save(coupons.create({
      userId: order.userId,
      code,
      description: `Quà tri ân đơn hàng #${order.id}: giảm ${discountValue}% và miễn phí vận chuyển`,
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      usageLimit: 1,
      usedCount: 0,
      startDate: now,
      endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
      freeShipping: true,
    }));
  }
 
  async dashboardSummary() {
    const orderValue = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getRawOne<{ revenue: string }>();
 
    const [orders, users, products, pendingOrders, revenueByDay, ordersByDay] = await Promise.all([
      this.orders.count({ where: { status: Not(OrderStatus.CANCELLED) } }),
      this.users.count(),
      this.products.count(),
      this.orders.count({ where: { status: OrderStatus.PENDING } }),
      this.orders
        .createQueryBuilder('o')
        .select("DATE_FORMAT(o.created_at, '%Y-%m-%d')", 'day')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'value')
        .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
        .andWhere('o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')
        .groupBy("DATE_FORMAT(o.created_at, '%Y-%m-%d')")
        .orderBy("DATE_FORMAT(o.created_at, '%Y-%m-%d')", 'ASC')
        .getRawMany<{ day: string; value: string }>(),
      this.orders
        .createQueryBuilder('o')
        .select("DATE_FORMAT(o.created_at, '%Y-%m-%d')", 'day')
        .addSelect('COUNT(o.id)', 'value')
        .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
        .andWhere('o.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')
        .groupBy("DATE_FORMAT(o.created_at, '%Y-%m-%d')")
        .orderBy("DATE_FORMAT(o.created_at, '%Y-%m-%d')", 'ASC')
        .getRawMany<{ day: string; value: string }>(),
    ]);
    const recent = await this.orders.find({ relations: ['items'], order: { createdAt: 'DESC' }, take: 8 });
    return {
      revenue: Number(orderValue?.revenue ?? 0),
      orders,
      pendingOrders,
      users,
      products,
      chartRevenueByDay: revenueByDay.map((row) => ({ day: String(row.day), value: Number(row.value) })),
      chartOrdersByDay: ordersByDay.map((row) => ({ day: String(row.day), value: Number(row.value) })),
      recentOrders: recent.map((order) => this.serialize(order)),
    };
  }
 
  async revenueSummary() {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select("DATE_FORMAT(o.created_at, '%Y-%m')", 'period')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy("DATE_FORMAT(o.created_at, '%Y-%m')")
      .orderBy('period', 'DESC')
      .getRawMany();
    return rows.map((row) => ({ period: row.period, orders: Number(row.orders), revenue: Number(row.revenue) }));
  }
 
  private serialize(order: Order) {
    const totalAmount = Number(order.totalAmount);
    const subtotalAmount = Number(order.subtotalAmount);
    return {
      id: order.id,
      userId: order.userId,
      fullName: order.fullName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      totalAmount,
      subtotalAmount: subtotalAmount > 0 ? subtotalAmount : totalAmount,
      discountAmount: Number(order.discountAmount || 0),
      couponCode: order.couponCode ?? null,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      note: order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
      })),
    };
  }
}
 
