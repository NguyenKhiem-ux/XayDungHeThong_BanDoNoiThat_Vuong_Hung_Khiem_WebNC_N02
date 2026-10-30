// file đọc sản phẩm được "mua riêng" (?productId=) trên URL checkout và lọc giỏ hàng chỉ còn món đó.
import { useLocalSearchParams } from 'expo-router';
import type { Cart } from '../types';

export function useCheckoutProductId() {
  const { productId } = useLocalSearchParams<{ productId?: string | string[] }>();
  const id = Number(Array.isArray(productId) ? productId[0] : productId);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

// Cùng cách tính với CheckoutPage của frontend Vite; backend vẫn tự tính lại khi báo giá và tạo đơn.
export function checkoutCart(cart: Cart | null, productId?: number): Cart | null {
  if (!cart || productId === undefined) return cart;
  const items = cart.items.filter(item => item.productId === productId);
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    couponEligibleTotal: items.reduce((sum, item) => sum + (item.product.discountPercent ? 0 : item.subtotal), 0),
    saleSavings: items.reduce((sum, item) => sum + (item.product.savings ?? 0) * item.quantity, 0),
  };
}
