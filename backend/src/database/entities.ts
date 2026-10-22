// file gom và export các entity của database để sử dụng tập trung.
import {
  ChatbotKnowledge,
  CheckoutRecord,
  Promotion,
  PromotionItem,
  ProductReview,
  Coupon,
  Cart,
  CartItem,
  ContactMessage,
  Favorite,
  Order,
  OrderItem,
  Payment,
  Product,
  PasswordResetToken,
  User,
  UserAddress,
} from './entities/index';

export const entities = [User, Product, Cart, CartItem, Order, OrderItem, Payment, ContactMessage, PasswordResetToken, UserAddress, Favorite, ChatbotKnowledge, Coupon, CheckoutRecord, Promotion, PromotionItem, ProductReview];
