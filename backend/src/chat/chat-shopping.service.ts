import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatProductsService, chatProduct, ProductContext, productResponse } from './chat-products.service';
import { normalizeText } from './chat-matching';
import { ChatDto } from './dto/chat.dto';
import { requestedQuantity, selectedOrdinal } from './intent.service';
import { CHAT_ACTIONS, ChatActionType, ChatIntent, ChatReply, CheckoutReview } from './chat.types';

export interface ShoppingSession {
  context?: ProductContext;
  query?: string;
  selectedId?: number;
  quantity: number;
  lastAction?: ChatActionType;
  pendingQuantity?: 'cart_add' | 'cart_update_quantity' | 'buy_now';
  review?: CheckoutReview;
}

@Injectable()
export class ChatShoppingService {
  constructor(private readonly products: ChatProductsService, private readonly cart: CartService,
    private readonly addresses: AddressesService) {}

  async handle(dto: ChatDto, intent: ChatIntent, state: ShoppingSession, user?: AuthUser): Promise<ChatReply | null> {
    const text = normalizeText(dto.message);
    const quantityInput = dto.quantity ?? requestedQuantity(dto.message);
    const action = dto.action ?? (CHAT_ACTIONS.includes(intent as ChatActionType) ? intent as ChatActionType :
      state.pendingQuantity && quantityInput !== undefined ? state.pendingQuantity : undefined);

    if (!action) {
      if (/\bre hon\b/.test(text)) {
        if (!state.selectedId) return this.reply('product_search', 'Bạn hãy chọn sản phẩm để mình tìm mẫu có giá thấp hơn.');
        const selected = await this.products.findById(state.selectedId);
        const keyword = state.context?.keyword || selected.category || selected.name;
        const query = `${keyword} dưới ${Number(selected.price) - 1} đồng`;
        const context = await this.products.context(query);
        state.context = context ?? { products: [], hash: '' };
        state.query = query;
        state.selectedId = undefined;
        state.review = undefined;
        state.quantity = 1;
        return productResponse(state.context, 'product_search');
      }
      if (state.context && (['product_stock', 'product_price', 'product_detail', 'product_comparison'].includes(intent)) &&
        (/\b(nay|do|ay|vua chon|so sanh)\b/.test(text) || /^(con hang khong|con may cai|gia bao nhieu|bao nhieu tien)$/.test(text))) {
        const ids = state.selectedId && intent !== 'product_comparison' ? [state.selectedId] : state.context.products.map(p => p.id);
        const products = await Promise.all(ids.map(id => this.products.findById(id)));
        return productResponse({ products, hash: '' }, intent);
      }
      return null;
    }

    const replyIntent = (action === 'checkout_confirm' ? 'checkout_review' : action) as ChatIntent;
    if (!dto.sessionId) return this.reply(replyIntent, 'Phiên trò chuyện chưa sẵn sàng. Vui lòng mở lại chatbot và chọn sản phẩm.');
    if (!['product_select'].includes(action) && !user) {
      return { ...this.reply(replyIntent, 'Bạn cần đăng nhập trước khi xem giỏ hàng hoặc thực hiện thao tác mua sắm.'),
        type: 'error', error: { code: 'LOGIN_REQUIRED', retryable: false } };
    }
    if (['cart_add', 'cart_remove', 'cart_update_quantity', 'checkout_confirm'].includes(action) && !dto.requestId) {
      throw new BadRequestException('Thao tác cần requestId để tránh xử lý lặp.');
    }
    if (action === 'cart_view') return this.cartReply(action, 'Giỏ hàng hiện tại của bạn:', await this.cart.get(user!.id));
    if (action === 'checkout_confirm' || action === 'checkout_review') {
      return this.review(dto, state, user!, action === 'checkout_confirm');
    }

    const candidates = action === 'cart_remove' || action === 'cart_update_quantity'
      ? (await this.cart.get(user!.id)).items.map(item => item.product) : state.context?.products ?? [];
    const ordinal = selectedOrdinal(dto.message);
    const list = action === 'cart_remove' || action === 'cart_update_quantity' ? candidates : state.context?.products ?? [];
    let id = dto.productId;
    if (id !== undefined && !candidates.some(product => Number(product.id) === id)) {
      return this.reply(replyIntent, 'Sản phẩm không còn trong danh sách hiện tại. Bạn hãy tìm hoặc xem giỏ hàng rồi chọn lại.');
    }
    if (!id && ordinal !== undefined) {
      id = Number(list[ordinal === -1 ? list.length - 1 : ordinal - 1]?.id) || undefined;
      if (!id) return this.reply(replyIntent, 'Không có sản phẩm ở vị trí đó trong kết quả gần nhất. Bạn hãy chọn lại.');
    }
    if (!id) {
      const named = candidates.filter(product => text.includes(normalizeText(product.name)));
      if (named.length === 1) id = Number(named[0].id);
    }
    if (!id) {
      const words = text.replace(/\b(toi|minh|muon|hay|vui|long|giup|cho|lay|chon|them|vao|khoi|gio|hang|bo|xoa|go|san|pham|vua|nay|do|ay|di|cai|chiec|mua|ngay|luon|cap|nhat|doi|sua|tang|giam|so|luong|thanh|la|len|xuong|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|khong|nhe|nha|a|\d+)\b/g, ' ')
        .split(/\s+/).filter(Boolean);
      const named = words.length ? candidates.filter(product => words.every(word => normalizeText(product.name).includes(word))) : [];
      if (named.length === 1) id = Number(named[0].id);
      else if (words.length) return this.reply(replyIntent, 'Mình chưa xác định được đúng sản phẩm. Bạn hãy tìm và bấm chọn sản phẩm cụ thể.');
      else id = state.selectedId;
    }
    if (!id) return this.reply(replyIntent, 'Bạn muốn thao tác với sản phẩm nào? Hãy chọn sản phẩm hoặc nói “chọn chiếc thứ hai” trong kết quả gần nhất.');

    if ((action === 'cart_remove' || action === 'cart_update_quantity') && !candidates.some(product => Number(product.id) === id)) {
      return this.reply(replyIntent, 'Sản phẩm đã chọn không có trong giỏ hàng của bạn. Bạn hãy xem giỏ và chọn lại.');
    }

    if (action === 'cart_remove') {
      const result = await this.cart.remove(user!.id, id);
      state.lastAction = action;
      state.review = undefined;
      return this.cartReply(action, 'Đã xóa sản phẩm khỏi giỏ hàng.', result);
    }

    const product = await this.products.findById(id);
    if (action === 'product_select') {
      state.selectedId = id;
      state.quantity = 1;
      state.review = undefined;
      state.pendingQuantity = undefined;
      state.lastAction = action;
      const response = productResponse({ products: [product], hash: '' }, action);
      response.message = `Bạn đã chọn ${product.name}. ${Number(product.price).toLocaleString('vi-VN')}đ; còn ${product.stock} chiếc.`;
      return response;
    }

    if (quantityInput === undefined && action === 'cart_update_quantity') {
      state.selectedId = id;
      state.pendingQuantity = action;
      return this.reply(replyIntent, 'Bạn muốn đổi thành bao nhiêu chiếc? Vui lòng nhập số lượng nguyên từ 1 đến 9999.');
    }
    const quantity = quantityInput ?? (state.selectedId === id ? state.quantity : 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) {
      state.pendingQuantity = action as ShoppingSession['pendingQuantity'];
      throw new BadRequestException('Số lượng phải là số nguyên từ 1 đến 9999.');
    }
    if (product.stock < quantity) throw new BadRequestException(`Sản phẩm chỉ còn ${product.stock} chiếc trong kho.`);

    if (action === 'buy_now') {
      state.selectedId = id;
      state.quantity = quantity;
      state.pendingQuantity = undefined;
      state.lastAction = action;
      return this.createReview(state, user!, product);
    }
    const result = action === 'cart_add' ? await this.cart.add(user!.id, id, quantity) : await this.cart.update(user!.id, id, quantity);
    state.selectedId = id;
    state.quantity = quantity;
    state.pendingQuantity = undefined;
    state.lastAction = action;
    state.review = undefined;
    return this.cartReply(replyIntent, action === 'cart_add' ? 'Đã thêm sản phẩm vào giỏ hàng.' : 'Đã cập nhật số lượng trong giỏ hàng.', result);
  }

  private async createReview(state: ShoppingSession, user: AuthUser, product: Awaited<ReturnType<ChatProductsService['findById']>>, addressId?: number) {
    const addresses = (await this.addresses.list(user.id)).map(({ id, fullName, phone, address, isDefault }) =>
      ({ id: Number(id), fullName, phone, address, isDefault }));
    if (addressId !== undefined && !addresses.some(address => address.id === addressId)) throw new BadRequestException('Địa chỉ không thuộc tài khoản của bạn.');
    const chosen = addresses.find(address => address.id === addressId) ?? addresses.find(address => address.isDefault);
    const cart = await this.cart.get(user.id);
    const items: CheckoutReview['items'] = cart.items.filter(item => Number(item.productId) !== Number(product.id))
      .map(item => ({ product: { id: item.product.id, name: item.product.name, price: item.product.price, stock: item.product.stock }, quantity: item.quantity, subtotal: item.subtotal }));
    items.push({ product: { id: product.id, name: product.name, price: Number(product.price), stock: product.stock }, quantity: state.quantity, subtotal: Number(product.price) * state.quantity });
    if (items.some(item => item.product.stock < item.quantity)) throw new BadRequestException('Một sản phẩm trong giỏ không đủ tồn kho. Bạn hãy kiểm tra lại giỏ hàng.');
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const review: CheckoutReview = {
      id: randomUUID(), product: chatProduct(product), quantity: state.quantity, subtotal: Number(product.price) * state.quantity, total, items,
      addresses, addressId: chosen?.id, confirmed: false,
      missingFields: [...(!chosen ? ['Địa chỉ và thông tin người nhận'] : []), 'Phương thức thanh toán'],
    };
    state.review = review;
    return this.reviewReply(review);
  }

  private async review(dto: ChatDto, state: ShoppingSession, user: AuthUser, confirm: boolean): Promise<ChatReply> {
    const previous = state.review;
    if (!previous || !state.selectedId) return this.reply('checkout_review', 'Bạn hãy chọn sản phẩm và bấm “Mua ngay” để chuẩn bị bản tóm tắt.');
    if (dto.reviewId && dto.reviewId !== previous.id || confirm && !dto.reviewId) {
      return this.reply('checkout_review', 'Bản tóm tắt đã thay đổi. Bạn hãy xem và xác nhận bản mới nhất.');
    }
    const product = await this.products.findById(state.selectedId);
    if (product.stock < state.quantity) throw new BadRequestException(`Sản phẩm chỉ còn ${product.stock} chiếc trong kho.`);
    const refreshed = await this.createReview(state, user, product, dto.addressId ?? previous.addressId);
    const current = state.review!;
    if (!confirm) return refreshed;
    if (current.total !== previous.total || JSON.stringify(current.product) !== JSON.stringify(previous.product) ||
      JSON.stringify(current.items) !== JSON.stringify(previous.items) ||
      JSON.stringify(current.addresses) !== JSON.stringify(previous.addresses) || current.addressId !== previous.addressId) {
      return { ...refreshed, message: 'Thông tin mua hàng đã thay đổi. Bạn hãy kiểm tra và xác nhận bản tóm tắt mới.' };
    }
    // Checkout currently purchases the entire cart: show that exact cart before handing off.
    // Set the selected line to the reviewed quantity; repeated confirmations never increment it.
    const cart = await this.cart.get(user.id);
    const existing = cart.items.find(item => item.productId === state.selectedId);
    const updated = existing ? await this.cart.update(user.id, state.selectedId, state.quantity) : await this.cart.add(user.id, state.selectedId, state.quantity);
    const signature = (items: Array<{ product: { id: number; price: number }; quantity: number }>) =>
      JSON.stringify(items.map(item => [item.product.id, item.product.price, item.quantity]).sort((a, b) => a[0] - b[0]));
    if (updated.total !== current.total || signature(updated.items) !== signature(current.items)) {
      const revised = await this.createReview(state, user, await this.products.findById(state.selectedId), current.addressId);
      return { ...revised, cart: updated, message: 'Giỏ hàng vừa thay đổi trong lúc xác nhận. Bạn hãy kiểm tra và xác nhận bản tóm tắt mới.' };
    }
    current.confirmed = true;
    state.lastAction = 'checkout_confirm';
    return { ...this.reviewReply(current), cart: updated, checkoutUrl: '/checkout/info', actions: [],
      message: 'Đã xác nhận bản tóm tắt và cập nhật sản phẩm vào giỏ. Checkout sẽ gồm toàn bộ giỏ hàng bên dưới; bạn tiếp tục điền thông tin giao hàng và chọn thanh toán. Chưa tạo đơn hoặc thu tiền.' };
  }

  private reviewReply(checkout: CheckoutReview): ChatReply {
    return { ...this.reply('checkout_review', 'Kiểm tra bản tóm tắt bên dưới: checkout gồm sản phẩm đã chọn và các sản phẩm khác đang có trong giỏ. Tổng tiền là tạm tính trước mã giảm giá. Bạn có thể chọn địa chỉ đã lưu; thông tin còn thiếu sẽ được điền tại checkout. Xác nhận sẽ cập nhật sản phẩm đã chọn vào giỏ.'),
      type: 'checkout_review', checkout,
      actions: [{ type: 'checkout_confirm', label: 'Xác nhận bản tóm tắt', reviewId: checkout.id }] };
  }

  private reply(intent: ChatIntent, message: string): ChatReply {
    return { intent, message, source: 'shopping', type: 'text', cached: false };
  }

  private cartReply(intent: ChatIntent, message: string, cart: Awaited<ReturnType<CartService['get']>>): ChatReply {
    return { ...this.reply(intent, message), type: 'cart', cart,
      actions: [...cart.items.flatMap(item => [
        { type: 'cart_update_quantity' as const, label: 'Đổi số lượng', productId: item.productId, quantity: item.quantity },
        { type: 'cart_remove' as const, label: 'Xóa', productId: item.productId },
      ]), ...(cart.items.length ? [{ type: 'checkout_start' as const, label: 'Checkout giỏ hàng' }, { type: 'cart_clear' as const, label: 'Xóa toàn bộ giỏ' }] : [])] };
  }
}
