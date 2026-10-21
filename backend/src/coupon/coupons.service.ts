import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Coupon,
  CouponDiscountType,
} from '../database/entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
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
  ): Promise<{
    valid: boolean;
    coupon: Coupon;
    discountAmount: number;
    finalAmount: number;
  }> {
    const coupon = await this.couponRepository.findOne({
      where: {
        code: code.trim().toUpperCase(),
      },
    });

    return evaluateCoupon(coupon, orderAmount, userId);
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

  let discountAmount = 0;

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
