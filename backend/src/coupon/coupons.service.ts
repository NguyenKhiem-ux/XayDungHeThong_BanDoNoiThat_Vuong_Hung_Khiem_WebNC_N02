import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CartService } from '../cart/cart.service';
import {
  Coupon,
  CouponDiscountType,
} from '../database/entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly cart: CartService,
  ) {}

  async findAll(userId?: number): Promise<Coupon[]> {
    return this.couponRepository.find({
      where: userId === undefined ? {} : [{ userId }, { userId: IsNull() }],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findAllAdmin(): Promise<Coupon[]> {
    return this.couponRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findAvailable(userId: number, productId?: number) {
    const coupons = await this.findAll(userId);
    const cart = await this.cart.get(userId);
    const items = productId === undefined
      ? cart.items
      : cart.items.filter((item) => item.productId === productId);
    if (!items.length) return [];

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const eligible = items.reduce(
      (sum, item) => sum + (item.product.discountPercent ? 0 : item.subtotal),
      0,
    );
    if (eligible <= 0) return [];

    return coupons.flatMap((coupon) => {
      try {
        const result = evaluateCoupon(coupon, eligible, userId);
        return [{ ...result, finalAmount: total - result.discountAmount }];
      } catch (error) {
        if (error instanceof BadRequestException) return [];
        throw error;
      }
    });
  }

  async findOne(id: number): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('Không tìm thấy mã giảm giá');
    }

    return coupon;
  }

  async create(data: Partial<Coupon>): Promise<Coupon> {
    if (!data.code) {
      throw new BadRequestException('Mã giảm giá không được để trống');
    }

    const code = data.code.trim().toUpperCase();

    const existingCoupon = await this.couponRepository.findOne({
      where: { code },
    });

    if (existingCoupon) {
      throw new BadRequestException('Mã giảm giá đã tồn tại');
    }

    const coupon = this.couponRepository.create({
      ...data,
      code,
    });

    return this.couponRepository.save(coupon);
  }

  async update(id: number, data: Partial<Coupon>): Promise<Coupon> {
    const coupon = await this.findOne(id);

    if (data.code) {
      const code = data.code.trim().toUpperCase();

      const existingCoupon = await this.couponRepository.findOne({
        where: { code },
      });

      if (existingCoupon && existingCoupon.id !== id) {
        throw new BadRequestException('Mã giảm giá đã tồn tại');
      }

      data.code = code;
    }

    Object.assign(coupon, data);

    return this.couponRepository.save(coupon);
  }

  async remove(id: number): Promise<void> {
    const coupon = await this.findOne(id);

    await this.couponRepository.remove(coupon);
  }

  async validateCoupon(
    code: string,
    orderAmount: number,
    userId?: number,
    productId?: number,
  ): Promise<{
    valid: boolean;
    coupon: Coupon;
    discountAmount: number;
    finalAmount: number;
  }> {
    if (productId !== undefined && (!Number.isSafeInteger(productId) || productId < 1)) throw new BadRequestException('Sản phẩm không hợp lệ.');
    const coupon = await this.couponRepository.findOne({
      where: {
        code: code.trim().toUpperCase(),
      },
    });

    const cart = userId === undefined ? null : await this.cart.get(userId);
    const items = productId === undefined ? cart?.items : cart?.items.filter(item => item.productId === productId);
    if (productId !== undefined && !items?.length) throw new BadRequestException('Sản phẩm không có trong giỏ hàng.');
    const total = items?.reduce((sum, item) => sum + item.subtotal, 0) ?? orderAmount;
    const eligible = items?.reduce((sum, item) => sum + (item.product.discountPercent ? 0 : item.subtotal), 0) ?? orderAmount;
    if (eligible <= 0) throw new BadRequestException('Mã giảm giá chỉ áp dụng cho sản phẩm không thuộc sự kiện ưu đãi.');
    const result = evaluateCoupon(coupon, eligible, userId);
    return { ...result, finalAmount: total - result.discountAmount };
  }
}


// Shared by previews and the locked order transaction; keep rounding and eligibility in one place.
export function evaluateCoupon(coupon: Coupon | null, orderAmount: number, userId?: number) {
  if (!coupon) {
    throw new BadRequestException('Mã giảm giá không tồn tại');
  }

  if (!coupon.isActive) {
    throw new BadRequestException('Mã giảm giá đã bị vô hiệu hóa');
  }
  if (coupon.userId !== null && coupon.userId !== userId) throw new BadRequestException('Mã giảm giá không thuộc tài khoản của bạn');

  const now = new Date();

  if (now < coupon.startDate) {
    throw new BadRequestException('Mã giảm giá chưa bắt đầu sử dụng');
  }

  if (now > coupon.endDate) {
    throw new BadRequestException('Mã giảm giá đã hết hạn');
  }

  if (
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng');
  }

  if (orderAmount < coupon.minOrderAmount) {
    throw new BadRequestException(
      `Đơn hàng tối thiểu ${coupon.minOrderAmount}đ`,
    );
  }

  let discountAmount: number;

  if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
    discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;

    if (
      coupon.maxDiscountAmount !== null &&
      discountAmount > Number(coupon.maxDiscountAmount)
    ) {
      discountAmount = Number(coupon.maxDiscountAmount);
    }
  } else {
    discountAmount = Number(coupon.discountValue);
  }

  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  discountAmount = Math.round(discountAmount);

  const finalAmount = orderAmount - discountAmount;

  return {
    valid: true,
    coupon,
    discountAmount,
    finalAmount,
  };
}
