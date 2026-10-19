// file xử lý PayOS, tạo link thanh toán và cập nhật webhook đã xác thực.
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PayOS, type Webhook, type WebhookData } from '@payos/node';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { OrderStatus, PaymentMethod, PaymentRecordStatus, PaymentStatus } from '../database/entities/enums';
import { Order } from '../database/entities/order.entity';
import { Payment } from '../database/entities/payment.entity';
import { User } from '../database/entities/user.entity';

@Injectable()
export class PaymentService {
  private payos: PayOS | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async confirmDemoCardPayment(userId: number, orderId: number, pin: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId }, lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này.');
      if (order.paymentMethod !== PaymentMethod.CARD) throw new BadRequestException('Đơn hàng này không thanh toán bằng thẻ.');
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Đơn hàng đã bị hủy.');
      if (order.paymentStatus === PaymentStatus.PAID) return { alreadyPaid: true };

      const user = await manager.getRepository(User).findOne({
        where: { id: userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!user?.transactionPinHash || !user.cardHolder || !user.cardType || !user.cardProvider || !user.cardLast4 || !user.cardExpMonth || !user.cardExpYear) {
        throw new BadRequestException('Hãy lưu thông tin thẻ và tạo PIN thanh toán trong hồ sơ trước.');
      }
      if (user.transactionPinLockedUntil && user.transactionPinLockedUntil.getTime() > Date.now()) {
        return { locked: true };
      }

      if (!(await bcrypt.compare(pin, user.transactionPinHash))) {
        user.transactionPinFailedAttempts += 1;
        if (user.transactionPinFailedAttempts >= 5) {
          user.transactionPinFailedAttempts = 0;
          user.transactionPinLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        await manager.save(User, user);
        return { invalidPin: true, locked: Boolean(user.transactionPinLockedUntil) };
      }

      const payment = await manager.getRepository(Payment).findOne({
        where: { orderId: order.id }, lock: { mode: 'pessimistic_write' },
      });
      if (!payment || payment.method !== PaymentMethod.CARD || payment.status !== PaymentRecordStatus.PENDING) {
        throw new BadRequestException('Trạng thái thanh toán không hợp lệ.');
      }

      payment.status = PaymentRecordStatus.SUCCESS;
      payment.transactionId = `DEMO-CARD-${order.id}-${Date.now()}`;
      payment.paidAt = new Date();
      order.paymentStatus = PaymentStatus.PAID;
      if (order.status === OrderStatus.PENDING) order.status = OrderStatus.CONFIRMED;
      user.transactionPinFailedAttempts = 0;
      user.transactionPinLockedUntil = null;
      await manager.save(Payment, payment);
      await manager.save(Order, order);
      await manager.save(User, user);
      return { paid: true };
    });

    if ('locked' in result && result.locked) {
      throw new HttpException('PIN bị khóa trong 15 phút do nhập sai nhiều lần.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if ('invalidPin' in result && result.invalidPin) {
      if (result.locked) throw new HttpException('PIN bị khóa trong 15 phút do nhập sai nhiều lần.', HttpStatus.TOO_MANY_REQUESTS);
      throw new UnauthorizedException('PIN thanh toán không chính xác.');
    }
    return { success: true, alreadyPaid: 'alreadyPaid' in result && result.alreadyPaid, simulated: true };
  }

  async createPayOSLink(userId: number, orderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['payment'] });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    if (!this.isPayOSMethod(order.paymentMethod)) throw new BadRequestException('Đơn hàng không dùng thanh toán QR');
    if (order.paymentStatus === PaymentStatus.PAID) throw new BadRequestException('Đơn hàng đã thanh toán');

    const payment = order.payment ?? (await this.payments.findOne({ where: { orderId: order.id } }));
    if (!payment || !this.isPayOSMethod(payment.method) || payment.status !== PaymentRecordStatus.PENDING) {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    }

    const paymentLink = await this.getPayOS().paymentRequests.create({
      orderCode: Number(order.id),
      amount: Number(order.totalAmount),
      description: `DH${order.id}`,
      returnUrl: this.buildReturnUrl(order.id),
      cancelUrl: this.config.getOrThrow<string>('PAYOS_CANCEL_URL'),
      buyerName: order.fullName,
      buyerEmail: order.email,
      buyerPhone: order.phone,
      buyerAddress: order.address,
    });

    return { checkoutUrl: paymentLink.checkoutUrl };
  }

  async handlePayOSWebhook(body: Webhook) {
    let data: WebhookData;
    try {
      data = await this.getPayOS().webhooks.verify(body);
    } catch {
      throw new BadRequestException('Webhook PayOS không hợp lệ');
    }

    if (!body.success || data.code !== '00') {
      return { ok: true };
    }

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: Number(data.orderCode) },
        relations: ['payment'],
      });
      if (!order) return { ok: true };

      const payment = order.payment ?? (await manager.getRepository(Payment).findOne({ where: { orderId: order.id } }));
      if (!payment || !this.isPayOSMethod(order.paymentMethod) || !this.isPayOSMethod(payment.method)) {
        return { ok: true };
      }

      if (order.paymentStatus === PaymentStatus.PAID && payment.status === PaymentRecordStatus.SUCCESS) {
        return { ok: true };
      }

      payment.status = PaymentRecordStatus.SUCCESS;
      payment.transactionId = data.reference;
      payment.paidAt = this.parsePayOSDate(data.transactionDateTime);
      order.paymentStatus = PaymentStatus.PAID;
      // A verified PayOS webhook is the source of truth: move the order into
      // processing automatically once the online payment has settled.
      if (order.status === OrderStatus.PENDING) order.status = OrderStatus.CONFIRMED;

      await manager.save(Payment, payment);
      await manager.save(Order, order);

      return { ok: true };
    });
  }

  private getPayOS() {
    if (!this.payos) {
      this.payos = new PayOS({
        clientId: this.config.getOrThrow<string>('PAYOS_CLIENT_ID'),
        apiKey: this.config.getOrThrow<string>('PAYOS_API_KEY'),
        checksumKey: this.config.getOrThrow<string>('PAYOS_CHECKSUM_KEY'),
      });
    }

    return this.payos;
  }

  private isPayOSMethod(method: PaymentMethod) {
    // QR is the current public checkout option; PAYOS remains supported for
    // orders created before the checkout method was renamed.
    return method === PaymentMethod.QR || method === PaymentMethod.PAYOS;
  }

  private buildReturnUrl(orderId: number) {
    const rawUrl = this.config.get<string>('PAYOS_RETURN_URL', 'http://localhost:5173/checkout/success');
    const resolved = rawUrl.replace(':orderId', String(orderId)).replace('{orderId}', String(orderId));
    if (resolved !== rawUrl) return resolved;

    const [base, query] = rawUrl.split('?');
    const url = `${base.replace(/\/+$/, '')}/${orderId}`;
    return query ? `${url}?${query}` : url;
  }

  private parsePayOSDate(value: string) {
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
