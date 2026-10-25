import { BadRequestException } from '@nestjs/common';

// Integer đồng, rounded once; BigInt avoids precision loss for the DECIMAL(15,0) price column.
export function salePrice(originalPrice: number, discountPercent: number) {
  if (!Number.isSafeInteger(originalPrice) || originalPrice < 0 || originalPrice > 999_999_999_999_999 ||
      !Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 99) {
    throw new BadRequestException('Giá hoặc phần trăm giảm không hợp lệ.');
  }
  return Number((BigInt(originalPrice) * BigInt(100 - discountPercent) + 50n) / 100n);
}

export function promotionPhase(event: { status: string; startsAt: Date; endsAt: Date }, now = new Date()) {
  if (event.status !== 'published') return event.status;
  return now >= event.endsAt ? 'ended' : now < event.startsAt ? 'scheduled' : 'active';
}
