import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdersService } from '../orders/orders.service';
import { CheckoutQuote } from '../orders/checkout.types';
import { PaymentService } from '../payment/payment.service';
import { PaymentMethod } from '../database/entities/enums';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { CreateAddressDto } from '../addresses/dto/address.dto';
import { CouponsService } from '../coupon/coupons.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatUserActionsService } from './chat-user-actions.service';
import { ChatProductsService } from './chat-products.service';
import { ChatAction, ChatCart, ChatCoupon, ChatReply, CHECKOUT_ACTIONS } from './chat.types';
import { ShoppingSession } from './chat-shopping.service';
import { ChatDto } from './dto/chat.dto';
import { normalizeText } from './chat-matching';
import { requestedQuantity, selectedOrdinal } from './intent.service';

type Stage = 'collecting_items' | 'collecting_address' | 'selecting_voucher' | 'selecting_payment' | 'awaiting_confirmation' | 'creating_order' | 'awaiting_payment' | 'completed' | 'cancelled';
type ChatOrder = Awaited<ReturnType<OrdersService['getOneForUser']>>;
export interface CheckoutFlow {
  stage: Stage;
  addressId?: number;
  addressIds?: number[];
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  quote?: CheckoutQuote;
  order?: ChatOrder;
  paymentUrl?: string;
  paymentError?: string;
}
export interface CheckoutSession { checkoutFlow?: CheckoutFlow }
export interface CheckoutView extends CheckoutFlow {
  appliedVoucher?: { code: string; discountAmount: number; finalAmount: number };
  cart: ChatCart;
  addresses: Awaited<ReturnType<AddressesService['list']>>;
  coupons: ChatCoupon[];
  paymentMethods: Array<{ value: PaymentMethod; label: string; description: string }>;
  actions: ChatAction[];
}
type State = ShoppingSession & CheckoutSession;

@Injectable()
export class ChatCheckoutService {
  constructor(private readonly orders: OrdersService, private readonly payment: PaymentService, private readonly cart: CartService,
    private readonly addresses: AddressesService, private readonly coupons: CouponsService,
    private readonly userActions: ChatUserActionsService, private readonly products: ChatProductsService) {}

  async handle(dto: ChatDto, state: State, user?: AuthUser, signal?: AbortSignal): Promise<ChatReply | null> {
    const resolved = this.resolve(dto, state);
    if (!resolved) return null;
    if (!user) return { ...this.reply('Bạn cần đăng nhập trước khi thực hiện checkout. Giỏ hàng sẽ được đọc lại sau khi đăng nhập.'), type: 'error', error: { code: 'LOGIN_REQUIRED', retryable: false } };
    if (!dto.sessionId || !dto.requestId) throw new BadRequestException('Checkout cần sessionId và requestId.');
    signal?.throwIfAborted();
    let flow = state.checkoutFlow;
    const { action } = resolved;
    try {
      if (action === 'checkout_start') {
        if (flow?.quote && !flow.order) await this.orders.cancelCheckout(user.id, flow.quote.id);
        flow = { stage: 'collecting_items', paymentMethod: this.paymentFromText(dto.message) };
        state.checkoutFlow = flow;
        state.pendingQuantity = undefined; state.review = undefined;
        if (dto.productId || dto.items || resolved.buy) {
          const items = await this.purchaseItems(dto, state, signal);
          if (!items) return this.view(user.id, flow, 'Hãy chọn sản phẩm cụ thể hoặc nêu tên và số lượng từng món. Chưa tạo đơn hàng.');
          signal?.throwIfAborted();
          await this.cart.setMany(user.id, items);
        }
        const current = await this.cart.get(user.id);
        if (!current.items.length) return this.view(user.id, flow, 'Giỏ hàng trống. Hãy tìm sản phẩm và chọn Mua ngay, hoặc thêm sản phẩm rồi bắt đầu checkout.');
        if (resolved.code) flow.couponCode = (await this.coupons.validateCoupon(resolved.code, current.total, user.id)).coupon.code;
        const addresses = await this.addresses.list(user.id);
        flow.addressId = addresses.find(a => a.isDefault)?.id;
        flow.stage = 'collecting_address';
        return this.view(user.id, flow, 'Checkout gồm toàn bộ giỏ hàng hiện tại. Hãy xác nhận địa chỉ giao hàng; chưa tạo đơn hoặc thu tiền.');
      }
      if (action === 'checkout_place_order') {
        // A retry can recover the order using the durable checkout ID even after RAM/session loss.
        const checkoutId = dto.checkoutId ?? flow?.quote?.id;
        const hash = dto.quoteHash ?? flow?.quote?.hash;
        if (!checkoutId || !hash || dto.action && (!dto.checkoutId || !dto.quoteHash)) throw new BadRequestException('Hãy xem bản tóm tắt và bấm Xác nhận đặt hàng.');
        if (dto.items || dto.address || dto.addressId || dto.productId || dto.quantity || dto.code !== undefined || dto.paymentMethod) throw new BadRequestException('Không sửa dữ liệu trong yêu cầu xác nhận. Hãy tạo bản tóm tắt mới.');
        const result = await this.orders.confirmCheckout(user.id, checkoutId, hash);
        flow ??= { stage: 'awaiting_confirmation' };
        state.checkoutFlow = flow;
        if (result.changed) {
          flow.quote = result.quote; flow.addressId = result.quote!.address.id; flow.couponCode = result.quote!.couponCode ?? undefined;
          flow.paymentMethod = result.quote!.paymentMethod; flow.stage = 'awaiting_confirmation';
          return this.view(user.id, flow, 'Giỏ hàng, giá, địa chỉ hoặc ưu đãi đã thay đổi. Hãy kiểm tra bản tóm tắt mới và xác nhận lại. Chưa tạo đơn.');
        }
        flow.order = result.order!;
        await this.afterOrder(user.id, flow, true);
        return this.view(user.id, flow, `Backend đã tạo đơn #${flow.order.id}. ${this.paymentMessage(flow.order)}`);
      }
      if (action === 'checkout_status' || action === 'checkout_payment_link') {
        const id = dto.orderId ?? flow?.order?.id;
        if (!id) throw new BadRequestException('Hãy chọn đơn hàng cần kiểm tra.');
        flow ??= { stage: 'awaiting_payment' }; state.checkoutFlow = flow;
        const ownedOrder = await this.orders.getOneForUser(user.id, id);
        if (flow.order?.id !== id) { flow.paymentUrl = undefined; flow.paymentError = undefined; }
        flow.order = ownedOrder;
        if (action === 'checkout_status') {
          try { await this.payment.refreshStatus(user.id, id); flow.paymentError = undefined; }
          catch (error) { if (!(error instanceof HttpException)) throw error; flow.paymentError = error.message; }
        }
        await this.afterOrder(user.id, flow, action === 'checkout_payment_link');
        return this.view(user.id, flow, `Đơn #${flow.order.id}: ${this.paymentMessage(flow.order)}`);
      }
      if (!flow) throw new BadRequestException('Chưa có checkout. Hãy bấm Mua ngay hoặc Checkout giỏ hàng.');
      if (action === 'checkout_cancel') {
        if (flow.order) return this.view(user.id, flow, `Đơn #${flow.order.id} đã tạo. Hủy hiển thị không hủy đơn hay hoàn tác thanh toán.`);
        if (flow.quote) await this.orders.cancelCheckout(user.id, flow.quote.id);
        state.checkoutFlow = { stage: 'cancelled' };
        return this.reply('Đã hủy bản nháp checkout. Chưa tạo đơn; các sản phẩm vẫn ở trong giỏ hàng.');
      }
      if (flow.order) return this.view(user.id, flow, 'Đơn đã được tạo. Bạn có thể kiểm tra trạng thái hoặc bắt đầu một checkout mới cho giỏ hàng mới.');
      if (action.startsWith('checkout_edit_')) {
        await this.invalidate(user.id, flow);
        flow.stage = action === 'checkout_edit_items' ? 'collecting_items' : action === 'checkout_edit_address' ? 'collecting_address' : action === 'checkout_edit_voucher' ? 'selecting_voucher' : 'selecting_payment';
      } else if (action === 'checkout_item_update' || action === 'checkout_item_remove') {
        await this.invalidate(user.id, flow);
        const cart = await this.cart.get(user.id);
        const ordinal = selectedOrdinal(dto.message);
        const named = cart.items.filter(i => normalizeText(dto.message).includes(normalizeText(i.product.name)));
        const id = dto.productId ?? (ordinal ? cart.items[ordinal === -1 ? cart.items.length - 1 : ordinal - 1]?.productId : undefined) ?? (named.length === 1 ? named[0].productId : undefined);
        if (!id || !cart.items.some(i => i.productId === id)) throw new BadRequestException('Hãy chọn đúng sản phẩm trong giỏ checkout.');
        if (action === 'checkout_item_remove') await this.cart.remove(user.id, id);
        else {
          const quantity = dto.quantity ?? requestedQuantity(dto.message) ?? Number(normalizeText(dto.message).match(/\b(?:len|thanh) (\d+)\b/)?.[1]);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) throw new BadRequestException('Số lượng phải từ 1 đến 9999.');
          await this.cart.update(user.id, id, quantity);
        }
        if (flow.addressId && flow.paymentMethod) await this.ready(user.id, flow); else flow.stage = 'collecting_items';
      } else if (action === 'checkout_address') {
        await this.invalidate(user.id, flow);
        if (dto.address) {
          const address = plainToInstance(CreateAddressDto, dto.address);
          const errors = await validate(address, { whitelist: true, forbidNonWhitelisted: true });
          if (errors.length) throw new BadRequestException('Cần đủ họ tên, số điện thoại và địa chỉ hợp lệ.');
          const created = await this.addresses.create(user.id, address); flow.addressId = created.id;
        } else {
          const list = await this.addresses.list(user.id);
          const ordinal = selectedOrdinal(dto.message);
          const id = dto.addressId ?? (ordinal ? flow.addressIds?.[ordinal === -1 ? flow.addressIds.length - 1 : ordinal - 1] : undefined) ?? flow.addressId;
          if (!id || !list.some(a => a.id === id)) throw new BadRequestException('Hãy chọn địa chỉ giao hàng thuộc tài khoản của bạn.');
          flow.addressId = id;
        }
        flow.stage = 'selecting_voucher';
      } else if (action === 'checkout_voucher' || action === 'checkout_best_voucher') {
        const cart = await this.cart.get(user.id);
        let code = dto.code ?? resolved.code ?? '';
        if (action === 'checkout_best_voucher') {
          const eligible = (await this.voucherViews(user.id, cart)).filter(v => v.eligible).sort((a, b) => (b.discountAmount ?? 0) - (a.discountAmount ?? 0));
          code = eligible[0]?.coupon.code ?? '';
        }
        const validated = code.trim() ? await this.coupons.validateCoupon(code, cart.total, user.id) : undefined;
        const needsAddress = !flow.addressId || flow.stage === 'collecting_address';
        await this.invalidate(user.id, flow);
        flow.couponCode = validated?.coupon.code;
        if (needsAddress) flow.stage = 'collecting_address';
        else if (flow.paymentMethod) await this.ready(user.id, flow);
        else flow.stage = 'selecting_payment';
      } else if (action === 'checkout_payment') {
        await this.invalidate(user.id, flow);
        const method = dto.paymentMethod ?? this.paymentFromText(dto.message) ?? flow.paymentMethod;
        if (!method || ![PaymentMethod.QR, PaymentMethod.CASH, PaymentMethod.CARD].includes(method)) throw new BadRequestException('Hãy chọn tiền mặt, PayOS/QR hoặc thẻ mô phỏng.');
        flow.paymentMethod = method;
        await this.ready(user.id, flow);
      } else if (action === 'checkout_preview') await this.ready(user.id, flow);
      return this.view(user.id, flow, flow.stage === 'awaiting_confirmation' ? 'Kiểm tra toàn bộ bản tóm tắt. Chỉ bấm Xác nhận đặt hàng khi bạn đồng ý tạo đơn.' : 'Hãy hoàn tất lựa chọn bên dưới để tiếp tục checkout.');
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const status = error.getStatus();
      if (![400, 403, 404, 409].includes(status)) throw error;
      const reply = flow ? await this.view(user.id, flow, error.message, true) : this.reply(error.message);
      return { ...reply, error: { code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 409 ? 'CHECKOUT_CHANGED' : 'VALIDATION_ERROR', retryable: false } };
    }
  }

  private resolve(dto: ChatDto, state: State): { action: typeof CHECKOUT_ACTIONS[number]; buy?: boolean; code?: string } | null {
    if ((CHECKOUT_ACTIONS as readonly string[]).includes(dto.action ?? '')) return { action: dto.action as typeof CHECKOUT_ACTIONS[number] };
    if (['buy_now', 'checkout_review', 'checkout_confirm'].includes(dto.action ?? '')) return { action: 'checkout_start', buy: dto.action === 'buy_now' };
    if (dto.action) return null;
    const text = normalizeText(dto.message);
    const flow = state.checkoutFlow;
    const active = flow && !['completed', 'cancelled'].includes(flow.stage);
    if (active && !flow.order && /\b(ma tot nhat|voucher tot nhat|giam nhieu nhat)\b/.test(text)) return { action: 'checkout_best_voucher' };
    // Preserve '-'/'_' in codes and accept letter-only codes such as K.
    const voucherText = dto.message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
    const voucherCode = voucherText.match(/^(?:(?:toi|minh|hay|cho toi|cho minh|toi muon|minh muon)\s+)*(?:ap dung|su dung|dung|chon)\s+(?:voucher|ma(?: giam gia)?)\s*[:=]?\s*["']?([a-z0-9][a-z0-9_-]{0,99})(?=$|[\s"'.,!?])/i)?.[1];
    if (voucherCode) return { action: active ? 'checkout_voucher' : 'checkout_start', code: voucherCode };
    if (active && /^(huy checkout|huy mua hang|huy mua|khong mua nua|dung dat hang)$/.test(text)) return { action: 'checkout_cancel' };
    if (flow?.stage === 'awaiting_confirmation' && /^(xac nhan dat hang|xac nhan mua hang|dong y dat hang)$/.test(text)) return { action: 'checkout_place_order' };
    if (flow?.order && /\b(thanh toan chua|kiem tra thanh toan|trang thai thanh toan|da tra tien chua)\b/.test(text)) return { action: 'checkout_status' };
    if (/\b(checkout|thanh toan gio hang|dat hang tu gio|xem lai thong tin mua)\b/.test(text)) return { action: 'checkout_start' };
    if (/^(?:(?:toi|minh|cho toi|cho minh|toi muon|minh muon|hay)\s+)*mua\b/.test(text) && !/\b(bao nhieu|chinh sach|bao hanh|doi tra|co duoc|co khong)\b/.test(text)) return { action: 'checkout_start', buy: true };
    if (!active || flow.order) return null;
    if (/\b(dia chi mac dinh|chon dia chi|dung dia chi)\b/.test(text) || flow.stage === 'collecting_address' && selectedOrdinal(dto.message) !== undefined) return { action: 'checkout_address' };
    if (/\b(bo voucher|bo ma|khong dung voucher|khong dung ma|khong co voucher)\b/.test(text)) return { action: 'checkout_voucher', code: '' };
    const code = voucherText.match(/^(?:voucher|ma(?: giam gia)?)\s*[:=]?\s*["']?([a-z0-9][a-z0-9_-]{0,99})["']?[.!?]?$/i)?.[1];
    if (code) return { action: 'checkout_voucher', code };
    if (this.paymentFromText(dto.message) && /\b(thanh toan|tra bang|chon|qr|payos|tien mat|cod|the)\b/.test(text)) return { action: 'checkout_payment' };
    if (/\b(so luong|tang|giam|doi)\b/.test(text) && /\b(len|thanh|so luong)\b/.test(text)) return { action: 'checkout_item_update' };
    if (/^(bo|xoa)\b/.test(text) && /\b(khoi don|khoi checkout)\b/.test(text)) return { action: 'checkout_item_remove' };
    if (/^(ok|u|duoc|dong y|xac nhan)$/.test(text)) return { action: 'checkout_preview' };
    return null;
  }

  private paymentFromText(message: string) {
    const text = normalizeText(message);
    return /\b(qr|payos)\b/.test(text) ? PaymentMethod.QR : /\b(tien mat|cod)\b/.test(text) ? PaymentMethod.CASH : /\b(the|card)\b/.test(text) ? PaymentMethod.CARD : undefined;
  }

  private async purchaseItems(dto: ChatDto, state: State, signal?: AbortSignal) {
    if (dto.items) return dto.items;
    const purchaseMessage = dto.message.split(/[,;]?\s*(?:giao\b|thanh toán\b)/i)[0].replace(/(?:[,;]\s*|\bvà\s*)+$/g, '').trim();
    const text = normalizeText(purchaseMessage);
    const ordinal = selectedOrdinal(purchaseMessage);
    const named = state.context?.products.filter(p => text.includes(normalizeText(p.name))) ?? [];
    const id = dto.productId ?? (ordinal ? state.context?.products[ordinal === -1 ? state.context.products.length - 1 : ordinal - 1]?.id : undefined) ??
      (named.length === 1 ? named[0].id : /\b(nay|do|vua chon)\b/.test(text) ? state.selectedId ?? (state.context?.products.length === 1 ? state.context.products[0].id : undefined) : undefined);
    if (id && !/\bva\b|[,;+]/.test(text)) {
      await this.products.findById(id);
      return [{ productId: Number(id), quantity: dto.quantity ?? requestedQuantity(purchaseMessage) ?? 1 }];
    }
    if (ordinal !== undefined && !id) return null;
    const message = purchaseMessage.replace(/^(?:(?:tôi|minh|mình|cho tôi|cho mình|tôi muốn|mình muốn|hãy)\s+)*mua(?: ngay)?\s*(?:(?:cho tôi|cho mình)\s+)?/i, 'Thêm ');
    return this.userActions.resolveItems({ ...dto, message }, undefined, signal);
  }

  private async invalidate(userId: number, flow: CheckoutFlow) {
    if (flow.quote) { await this.orders.cancelCheckout(userId, flow.quote.id); flow.quote = undefined; }
  }
  private async ready(userId: number, flow: CheckoutFlow) {
    if (!flow.addressId) { flow.stage = 'collecting_address'; return; }
    if (!flow.paymentMethod) { flow.stage = 'selecting_payment'; return; }
    const quote = await this.orders.previewCheckout(userId, { addressId: flow.addressId, paymentMethod: flow.paymentMethod, couponCode: flow.couponCode }, flow.quote?.id);
    flow.quote = quote; flow.stage = 'awaiting_confirmation';
  }

  private async afterOrder(userId: number, flow: CheckoutFlow, createLink: boolean) {
    const order = flow.order!;
    if (createLink && ['QR', 'PAYOS'].includes(order.paymentMethod) && order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED') {
      try { flow.paymentUrl = (await this.payment.createPayOSLink(userId, order.id)).checkoutUrl; flow.paymentError = undefined; }
      catch (error) { if (!(error instanceof HttpException)) throw error; flow.paymentError = error.message; }
    }
    flow.order = await this.orders.getOneForUser(userId, order.id);
    flow.stage = flow.order.paymentStatus === 'PAID' || flow.order.paymentMethod === PaymentMethod.CASH || flow.order.status === 'CANCELLED' ? 'completed' : 'awaiting_payment';
    if (flow.order.paymentStatus === 'PAID' || flow.order.status === 'CANCELLED') { flow.paymentUrl = undefined; flow.paymentError = undefined; }
  }
  private paymentMessage(order: ChatOrder) { return order.paymentStatus === 'PAID' ? (order.paymentMethod === 'CARD' ? 'Đã thanh toán thẻ mô phỏng; không thu tiền thật.' : 'Backend đã xác minh thanh toán thành công.') : order.paymentMethod === 'CASH' ? 'Chưa thanh toán; thanh toán khi nhận hàng.' : 'Chưa xác minh thanh toán. Bạn có thể thanh toán và kiểm tra lại trạng thái.'; }
  private reply(message: string): ChatReply { return { message, source: 'shopping', intent: 'checkout_review', cached: false }; }
  private async voucherViews(userId: number, cart: ChatCart): Promise<ChatCoupon[]> {
    const views: ChatCoupon[] = [];
    for (const coupon of await this.coupons.findAll(userId)) {
      const active = coupon.isActive && +new Date(coupon.startDate) <= Date.now() && +new Date(coupon.endDate) >= Date.now() && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit);
      try {
        const result = await this.coupons.validateCoupon(coupon.code, cart.total, userId);
        views.push({ coupon, active, eligible: !!cart.items.length, reason: cart.items.length ? 'Đủ điều kiện với giỏ hiện tại.' : 'Giỏ hàng đang trống.', discountAmount: result.discountAmount, finalAmount: result.finalAmount });
      } catch (error) { if (!(error instanceof BadRequestException)) throw error; views.push({ coupon, active, eligible: false, reason: error.message }); }
    }
    return views;
  }

  private async view(userId: number, flow: CheckoutFlow, message: string, invalid = false): Promise<ChatReply> {
    const cart = await this.cart.get(userId);
    const addresses = await this.addresses.list(userId); flow.addressIds = addresses.map(a => a.id);
    const coupons = flow.order ? [] : await this.voucherViews(userId, cart);
    const selected = coupons.find(view => view.eligible && view.coupon.code === flow.couponCode);
    const appliedVoucher = selected ? { code: selected.coupon.code, discountAmount: selected.discountAmount!, finalAmount: selected.finalAmount! } : undefined;
    const actions: ChatAction[] = [];
    if (flow.order) {
      actions.push({ type: 'checkout_status', label: 'Kiểm tra trạng thái', orderId: flow.order.id });
      if (flow.stage === 'awaiting_payment' && ['QR', 'PAYOS'].includes(flow.order.paymentMethod)) actions.push({ type: 'checkout_payment_link', label: 'Lấy lại link PayOS', orderId: flow.order.id });
    } else {
      if (flow.stage === 'collecting_address') actions.push({ type: 'checkout_address', label: 'Dùng địa chỉ này' });
      if (flow.stage === 'selecting_voucher') actions.push({ type: 'checkout_voucher', label: 'Tiếp tục không dùng voucher', code: '' }, { type: 'checkout_best_voucher', label: 'Chọn mã giảm nhiều nhất' });
      if (flow.stage === 'selecting_payment') actions.push({ type: 'checkout_payment', label: 'Xem bản xác nhận' });
      if (flow.stage === 'collecting_items' && cart.items.length) actions.push({ type: 'checkout_preview', label: 'Tiếp tục checkout' });
      if (flow.quote && flow.stage === 'awaiting_confirmation' && !invalid) actions.push({ type: 'checkout_place_order', label: 'Xác nhận đặt hàng', checkoutId: flow.quote.id, quoteHash: flow.quote.hash });
      if (flow.addressId && flow.paymentMethod) actions.push({ type: 'checkout_preview', label: 'Làm mới bản tóm tắt' });
      if (cart.items.length) actions.push(...cart.items.flatMap(i => [{ type: 'checkout_item_update' as const, label: 'Cập nhật', productId: i.productId }, { type: 'checkout_item_remove' as const, label: 'Bỏ khỏi đơn', productId: i.productId }]));
      actions.push({ type: 'checkout_edit_items', label: 'Sửa giỏ hàng' }, { type: 'checkout_edit_address', label: 'Đổi địa chỉ' }, { type: 'checkout_edit_voucher', label: 'Đổi voucher' }, { type: 'checkout_edit_payment', label: 'Đổi thanh toán' }, { type: 'checkout_cancel', label: 'Hủy checkout' });
    }
    return { ...this.reply(message), cart, checkoutFlow: { ...flow, cart, addresses, coupons, actions, appliedVoucher,
      paymentMethods: [{ value: PaymentMethod.CASH, label: 'Tiền mặt', description: 'Thanh toán khi nhận hàng' }, { value: PaymentMethod.QR, label: 'PayOS / QR', description: 'Thanh toán tại trang PayOS' }, { value: PaymentMethod.CARD, label: 'Thẻ mô phỏng', description: 'Xác minh qua form PIN riêng, không thu tiền thật' }] } };
  }
}
