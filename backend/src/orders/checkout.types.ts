import { PaymentMethod } from '../database/entities/enums';

export interface CheckoutSelection { addressId: number; paymentMethod: PaymentMethod; couponCode?: string; productId?: number }
export interface CheckoutSnapshot {
  productId?: number;
  items: Array<{ productId: number; name: string; imageUrl: string | null; price: number; quantity: number; subtotal: number; originalPrice?: number; promotionId?: number | null }>;
  address: { id?: number; fullName: string; phone: string; address: string };
  email: string;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  note: string | null;
}
export type CheckoutQuote = CheckoutSnapshot & { id: string; hash: string; expiresAt: string };
