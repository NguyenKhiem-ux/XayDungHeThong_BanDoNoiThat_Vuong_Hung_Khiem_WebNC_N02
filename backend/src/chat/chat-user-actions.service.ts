import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdersService } from '../orders/orders.service';
import { FavoritesService } from '../favorites/favorites.service';
import { AddressesService } from '../addresses/addresses.service';
import { CreateAddressDto, UpdateAddressDto } from '../addresses/dto/address.dto';
import { CouponsService } from '../coupon/coupons.service';
import { CartService } from '../cart/cart.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatProductsService, productQuery } from './chat-products.service';
import { GeminiService, InterpretedAction } from './gemini.service';
import { normalizeText } from './chat-matching';
import { selectedOrdinal, requestedQuantity, shoppingIntent, shoppingVerb } from './intent.service';
import { ChatAction, ChatActionType, ChatCart, ChatReply, USER_ACTIONS } from './chat.types';
import { ShoppingSession } from './chat-shopping.service';
import { ChatDto } from './dto/chat.dto';

type Domain = 'orders' | 'addresses' | 'favorites' | 'coupons';
type AddressDraft = { addressId?: number; values: UpdateAddressDto };
type Confirmation = { id: string; expiresAt: number; summary: string } &
  ({ type: 'cart_clear'; items: Array<{ productId: number; quantity: number }> } |
   { type: 'address_delete'; addressId: number; snapshot: { fullName: string; phone: string; address: string; isDefault: boolean } });
export interface UserActionSession {
  userDomain?: Domain;
  orderIds?: number[];
  viewedOrderId?: number;
  addressIds?: number[];
  favoriteIds?: number[];
  couponCodes?: string[];
  viewedCouponCode?: string;
  addressDraft?: AddressDraft;
  confirmation?: Confirmation;
  pendingSelection?: { action: typeof USER_ACTIONS[number]; domain: Domain };
}
type State = ShoppingSession & UserActionSession;

// Credential-like messages stop before either the action interpreter or shared knowledge handling.
export function hasChatSecret(message: string) {
  return /\b(password|mat khau|otp|pin|token|jwt|authorization|bearer|api key|secret|credential|so the|cvv|cvc)\b/.test(normalizeText(message)) || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{13,19}\b|\bAIza[A-Za-z0-9_-]{30,}|\bsk-[A-Za-z0-9_-]{20,}/.test(message);
}
const labels: Record<Domain, string> = { orders: 'đơn hàng', addresses: 'địa chỉ', favorites: 'yêu thích', coupons: 'voucher' };
const addressSnapshot = (a: { fullName: string; phone: string; address: string; isDefault: boolean }) => JSON.stringify([a.fullName, a.phone, a.address, a.isDefault]);

@Injectable()
export class ChatUserActionsService {
  constructor(private readonly orders: OrdersService, private readonly favorites: FavoritesService,
    private readonly addresses: AddressesService, private readonly coupons: CouponsService,
    private readonly cart: CartService, private readonly products: ChatProductsService,
    private readonly gemini: GeminiService) {}

  async handle(dto: ChatDto, state: State, user?: AuthUser, signal?: AbortSignal): Promise<ChatReply | null> {
    if (hasChatSecret(dto.message)) return this.reply('Đừng gửi mật khẩu, OTP, PIN, token hoặc thông tin thẻ vào chatbot. Hãy dùng trang tài khoản/thanh toán.');
    if (!dto.action && /\b(khong|dung|chua)\b.{0,25}\b(them|xoa|bo|go|sua|doi|dat)\b/.test(normalizeText(dto.message))) {
      state.confirmation = undefined; state.addressDraft = undefined; state.pendingSelection = undefined; state.pendingQuantity = undefined;
      return this.reply('Mình chưa thực hiện thao tác này và đã bỏ bước đang chờ. Bạn có thể nói rõ thao tác muốn làm.');
    }
    if (!dto.action && /\b(huy|sua|doi)\b.*\bdon hang\b/.test(normalizeText(dto.message))) return this.reply('Chatbot hiện hỗ trợ xem và tra cứu đơn hàng. Dự án chưa có thao tác user để hủy hoặc sửa đơn hàng.');
    const resolved = await this.resolve(dto, state, signal);
    if (!resolved) return null;
    signal?.throwIfAborted();
    if (!dto.sessionId) return this.reply('Hãy mở lại chatbot để bắt đầu phiên thao tác.');
    if (!user) return { ...this.reply('Bạn cần đăng nhập để thao tác với dữ liệu của mình.'), type: 'error', error: { code: 'LOGIN_REQUIRED', retryable: false } };
    const { action } = resolved;
    const favoriteToCart = action === 'cart_add_many' && state.userDomain === 'favorites' ? this.ordinalId(state.favoriteIds, resolved.ordinal) : undefined;
    state.pendingQuantity = undefined;
    state.review = undefined;
    const read = ['orders_list', 'order_detail', 'favorites_list', 'addresses_list', 'coupons_list', 'coupon_detail'];
    if (!read.includes(action) && !dto.requestId) throw new BadRequestException('Thao tác cần requestId để tránh xử lý lặp.');
    // A new operation invalidates the previous destructive confirmation and incomplete form.
    if (!['action_confirm', 'action_cancel'].includes(action)) state.confirmation = undefined;
    if (!['address_create', 'address_update'].includes(action)) state.addressDraft = undefined;
    if (action !== `${state.pendingSelection?.domain}_list`) state.pendingSelection = undefined;
    if (action.startsWith('cart_')) state.userDomain = undefined;
    try {
      if (action === 'action_cancel') {
        state.confirmation = undefined; state.addressDraft = undefined;
        return this.reply('Đã hủy thao tác đang chờ xác nhận.');
      }
      if (action === 'action_confirm') return await this.confirm(dto, state, user.id);
      if (action === 'orders_list') {
        const orders = await this.orders.listForUser(user.id);
        state.orderIds = orders.map(o => o.id); state.userDomain = 'orders'; state.viewedOrderId = undefined;
        return { ...this.reply(orders.length ? 'Đơn hàng của bạn, mới nhất trước:' : 'Bạn chưa có đơn hàng.'), orders,
          actions: orders.map(o => ({ type: 'order_detail', label: `Chi tiết đơn #${o.id}`, orderId: o.id })) };
      }
      if (action === 'order_detail') {
        const recent = /\b(gan nhat|moi nhat)\b/.test(normalizeText(dto.message));
        if (recent && !state.orderIds?.length) state.orderIds = (await this.orders.listForUser(user.id)).map(o => o.id);
        const literal = dto.message.match(/(?:#\s*|(?:mã đơn|đơn hàng)\s*[:#]?\s*)(\d+)\b/i)?.[1];
        const id = dto.orderId ?? (literal ? Number(literal) : undefined) ?? this.ordinalId(state.orderIds, recent ? 1 : resolved.ordinal) ??
          (/\b(nay|vua xem)\b/.test(normalizeText(dto.message)) ? state.viewedOrderId : undefined);
        if (!id) return this.askSelection(state, action, 'orders');
        if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException('Mã đơn hàng không hợp lệ.');
        const order = await this.orders.getOneForUser(user.id, id);
        state.userDomain = 'orders'; state.viewedOrderId = order.id;
        return { ...this.reply(`Chi tiết đơn hàng #${order.id}:`), orders: [order] };
      }
      if (action.startsWith('favorite')) return await this.favorite(dto, resolved, state, user.id);
      if (action.startsWith('address')) return await this.address(dto, resolved, state, user.id);
      if (action.startsWith('coupon')) return await this.voucher(dto, resolved, state, user.id);
      if (action === 'cart_clear') {
        const cart = await this.cart.get(user.id);
        if (!cart.items.length) return this.cartReply('Giỏ hàng đang trống.', cart);
        const summary = `Xóa toàn bộ ${cart.itemCount} sản phẩm trong giỏ: ${cart.items.map(i => `${i.quantity} × ${i.product.name}`).join(', ')}?`;
        state.confirmation = { id: randomUUID(), type: 'cart_clear', summary, expiresAt: Date.now() + 5 * 60_000,
          items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })) };
        return { ...this.confirmationReply(state.confirmation), cart };
      }
      if (action === 'cart_add_many') return await this.addMany(favoriteToCart ? { ...dto, items: [{ productId: favoriteToCart, quantity: dto.quantity ?? requestedQuantity(dto.message) ?? 1 }] } : dto, resolved, state, user.id, signal);
      return this.reply('Bạn hãy chọn một thao tác trong giỏ hàng, đơn hàng, yêu thích, địa chỉ hoặc voucher.');
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const status = error.getStatus();
      if (![400, 403, 404].includes(status)) throw error;
      return { ...this.reply(error.message), type: 'error', error: {
        code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', retryable: false } };
    }
  }

  private async resolve(dto: ChatDto, state: State, signal?: AbortSignal): Promise<InterpretedAction | null> {
    if (dto.action) return (USER_ACTIONS as readonly string[]).includes(dto.action) ? { action: dto.action as InterpretedAction['action'] } : null;
    const text = normalizeText(dto.message);
    const verb = shoppingVerb(text);
    const ordinal = selectedOrdinal(dto.message);
    const result = (action: InterpretedAction['action']): InterpretedAction => ({ action, ordinal });
    if (/^(huy|huy bo|thoi|dung lai|khong|khong dong y|khong xoa)$/.test(text) && (state.confirmation || state.addressDraft || state.pendingSelection)) return result('action_cancel');
    if (/^(xac nhan|dong y|dong y xoa|xac nhan xoa|co|ok)$/.test(text) && state.confirmation) return result('action_confirm');
    if (ordinal !== undefined && state.pendingSelection && !/\b(them|tao|xem|danh sach|sua|doi|cap nhat|xoa|bo|go|mac dinh|gio)\b/.test(text) &&
      (!/\b(don|dia chi|yeu thich|voucher|coupon)\b/.test(text) || text.includes(normalizeText(labels[state.pendingSelection.domain])))) return result(state.pendingSelection.action);
    if (state.addressDraft && !shoppingIntent(text) && !/\b(don hang|yeu thich|voucher|coupon|gio hang|tim san pham)\b/.test(text)) return result(state.addressDraft.addressId ? 'address_update' : 'address_create');
    if (/\b(xoa|don|lam trong|bo)\b.*\b(tat ca|toan bo|het|sach|trong)\b.*\bgio\b|\b(xoa|lam trong|don sach)\b.*\bgio\b.*\b(tat ca|toan bo|het|sach)\b|^lam trong gio hang$/.test(text)) return result('cart_clear');
    if (/\b(dia chi)\b/.test(text) && !/\b(shop|cua hang|chi nhanh|o dau)\b/.test(text)) {
      if (/\b(mac dinh)\b/.test(text) && ['dat', 'chon', 'doi', 'lam'].includes(verb ?? '')) return result('address_default');
      if (['xoa', 'bo', 'go'].includes(verb ?? '')) return result('address_delete');
      if (['them', 'tao', 'luu moi'].includes(verb ?? '')) return result('address_create');
      if (['sua', 'cap nhat', 'doi'].includes(verb ?? '')) return result('address_update');
      if (/\b(cua toi|cua minh|da luu|danh sach|xem|liet ke|nhan hang|giao hang)\b/.test(text)) return result('addresses_list');
      // Address prose stays local, including names, phones and street addresses.
      return result('addresses_list');
    }
    if (/\b(yeu thich|favorite|da luu)\b/.test(text)) {
      if (['them', 'luu', 'danh dau'].includes(verb ?? '')) return result('favorite_add');
      if (['bo', 'xoa', 'go'].includes(verb ?? '')) return result('favorite_remove');
      return result('favorites_list');
    }
    if (/\b(voucher|coupon|ma giam gia|uu dai cua toi)\b/.test(text)) {
      const codes = dto.message.match(/\b[A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\b/g);
      const known = state.couponCodes?.find(c => text.includes(normalizeText(c)));
      const code = known ?? (codes?.length === 1 ? codes[0] : undefined);
      const detail = code || ordinal || !/\b(nao|cac|danh sach|nhung|co ma)\b/.test(text) && /\b(chi tiet|kiem tra|ma nay|ma do)\b/.test(text);
      return { ...result(detail ? 'coupon_detail' : 'coupons_list'), code };
    }
    if (state.userDomain === 'coupons' && /\b(ma nay|ma do|giam bao nhieu|dieu kien|dung duoc)\b/.test(text)) return { ...result('coupon_detail'), code: state.viewedCouponCode };
    if (/\b(don hang|lich su mua|cac don|don cua toi|don cua minh|ma don)\b/.test(text) || ordinal !== undefined && /\bdon\b/.test(text)) {
      if (/\b(huy|doi|sua|dat|tao)\b/.test(text)) return null; // No user order mutation API in phase 1.
      if (ordinal !== undefined || /\b(chi tiet|trang thai|thanh toan|tra cuu|kiem tra|ma don)\b/.test(text) || /#\s*\d+/.test(dto.message)) return result('order_detail');
      return result('orders_list');
    }
    if (ordinal !== undefined && state.userDomain === 'orders' && /\b(don|chi tiet|trang thai|xem|cai)\b/.test(text)) return result('order_detail');
    if (ordinal !== undefined && state.userDomain === 'addresses' && !/\b(gio|san pham|so luong)\b/.test(text)) {
      if (/\b(xoa|bo|go)\b/.test(text)) return result('address_delete');
      if (/\b(mac dinh)\b/.test(text)) return result('address_default');
      if (/\b(sua|doi|cap nhat)\b/.test(text)) return result('address_update');
      return result('addresses_list');
    }
    if (ordinal !== undefined && state.userDomain === 'favorites') {
      if (/\b(them)\b/.test(text) && /\bgio\b/.test(text)) return result('cart_add_many');
      if (/\b(xoa|bo|go)\b/.test(text) && !/\bgio\b/.test(text)) return result('favorite_remove');
    }
    if (ordinal !== undefined && state.userDomain === 'coupons') return result('coupon_detail');
    if (/\bthem\b/.test(text) && /[,;+]|\bva\b/.test(text)) return result('cart_add_many');
    if (/\bthem\b/.test(text) && !state.context && !/\b(nay|do|ay|vua chon|thu)\b/.test(text)) return result('cart_add_many');
    if (/\bthem\b/.test(text) && state.context?.products.some(p => text.includes(normalizeText(p.name))) && /\b(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\b/.test(text)) return result('cart_add_many');
    if (shoppingIntent(text)) return null;
    // Semantic fallback complements the deterministic shortcuts. Never send personal fields or secrets.
    if (/[@]|(?:\+?84|0)\d[\d .-]{7,}/.test(dto.message)) return null;
    const scoped = /\b(don|lich su|yeu thich|thich|luu|danh dau|voucher|coupon|uu dai|gio|san pham)\b/.test(text);
    if (!scoped || /\b(chinh sach|bao hanh|hoan tien|doi tra|phi ship|tu van|phoi mau|trang tri)\b/.test(text)) return null;
    if (productQuery(dto.message).related && !/\b(them|bo|xoa|go|danh dau|luu|thich|gio|don)\b/.test(text)) return null;
    // Existing explicit shopping requests keep their proven resolver; name-only additions get extraction.
    if (/\b(mua ngay|chon|so luong|xem gio|xoa san pham|bo san pham)\b/.test(text)) return null;
    if (/\bthem\b/.test(text) && (state.context || /\b(cai nay|vua chon|thu|cai|chiec)\b/.test(text))) return null;
    const semantic = await this.gemini.interpretAction(dto.message, state.userDomain, signal);
    if (semantic?.query && !text.includes(normalizeText(semantic.query))) return null;
    if (semantic?.code && !text.includes(normalizeText(semantic.code))) return null;
    return semantic;
  }

  private async favorite(dto: ChatDto, resolved: InterpretedAction, state: State, userId: number) {
    const current = await this.favorites.list(userId);
    if (resolved.action !== 'favorites_list') {
      const list = resolved.action === 'favorite_remove' ? current.map(f => f.product) : state.context?.products ?? [];
      let id = dto.productId ?? this.ordinalId(resolved.action === 'favorite_remove' ? state.favoriteIds : list.map(p => p.id), resolved.ordinal);
      if (!id && resolved.query) id = await this.resolveProduct(resolved.query);
      if (!id) {
        const named = list.filter(p => normalizeText(dto.message).includes(normalizeText(p.name)));
        if (named.length === 1) id = named[0].id;
        else if (resolved.ordinal === undefined && !resolved.query && /\b(nay|vua chon|dang chon)\b/.test(normalizeText(dto.message))) id = state.selectedId;
      }
      if (!id && resolved.ordinal === undefined) {
        const name = dto.message.replace(/(?:thêm|bỏ|xóa|gỡ|khỏi|vào|danh sách|yêu thích|sản phẩm|cho tôi|cho mình|giúp tôi|giúp mình|tôi muốn|tôi|mình|này|vừa chọn|đang chọn|nha|nhé)/gi, ' ').replace(/\s+/g, ' ').trim();
        if (name) id = await this.resolveProduct(name);
      }
      if (!id) return this.askSelection(state, resolved.action, 'favorites');
      if (resolved.action === 'favorite_remove') {
        if (!current.some(f => f.productId === id)) throw new BadRequestException('Sản phẩm không có trong danh sách yêu thích của bạn.');
        await this.favorites.remove(userId, id);
      } else {
        await this.products.findById(id);
        await this.favorites.add(userId, id);
      }
    }
    const favorites = resolved.action === 'favorites_list' ? current : await this.favorites.list(userId);
    state.favoriteIds = favorites.map(f => f.productId); state.userDomain = 'favorites';
    // Product and favorite lists have independent ordinal slots.
    return { ...this.reply(resolved.action === 'favorites_list' ? (favorites.length ? 'Sản phẩm yêu thích của bạn:' : 'Danh sách yêu thích đang trống.') : 'Đã cập nhật danh sách yêu thích.'), favorites,
      actions: favorites.flatMap(f => [{ type: 'favorite_remove' as const, label: 'Bỏ yêu thích', productId: f.productId },
        ...(f.product.stock > 0 ? [{ type: 'cart_add_many' as const, label: 'Thêm vào giỏ', items: [{ productId: f.productId, quantity: 1 }] }] : [])]) };
  }

  private async address(dto: ChatDto, resolved: InterpretedAction, state: State, userId: number): Promise<ChatReply> {
    let rows = await this.addresses.list(userId);
    if (resolved.action === 'addresses_list') return this.addressReply(rows, state, 'Địa chỉ đã lưu của bạn:');
    if (resolved.action === 'address_create' && dto.addressId !== undefined) throw new BadRequestException('Thêm địa chỉ mới không nhận addressId.');
    const candidate = state.addressDraft;
    const draft = candidate && (dto.addressId === undefined || dto.addressId === candidate.addressId) &&
      (resolved.action === 'address_create' ? candidate.addressId === undefined : candidate.addressId !== undefined) ? candidate : undefined;
    let id = dto.addressId ?? draft?.addressId ?? this.ordinalId(state.addressIds, resolved.ordinal);
    if (!id && resolved.action !== 'address_create') {
      const text = normalizeText(dto.message);
      const named = rows.filter(a => text.includes(normalizeText(a.address)));
      if (named.length === 1 && normalizeText(named[0].address).length > 4) id = named[0].id;
    }
    const current = id ? rows.find(a => a.id === id) : undefined;
    if (id && !current) throw new NotFoundException('Địa chỉ không tồn tại trong tài khoản của bạn.');
    if (resolved.action !== 'address_create' && !id) return this.askSelection(state, resolved.action, 'addresses');
    if (resolved.action === 'address_delete') {
      const summary = `Xóa địa chỉ: ${current!.fullName} · ${current!.phone} · ${current!.address}${current!.isDefault ? ' (mặc định)' : ''}?`;
      const { fullName, phone, address, isDefault } = current!;
      state.confirmation = { id: randomUUID(), type: 'address_delete', addressId: id!, snapshot: { fullName, phone, address, isDefault }, summary, expiresAt: Date.now() + 5 * 60_000 };
      return this.confirmationReply(state.confirmation);
    }
    if (resolved.action === 'address_default') {
      await this.addresses.update(userId, id!, { isDefault: true });
      return { ...this.addressReply(await this.addresses.list(userId), state, 'Đã đặt địa chỉ mặc định.'), };
    }
    const values: UpdateAddressDto = { ...(draft?.values ?? {}), ...this.addressFields(dto.message, draft), ...dto.address };
    for (const field of ['fullName', 'phone', 'address'] as const) if (typeof values[field] === 'string') values[field] = values[field]!.trim();
    state.addressDraft = { addressId: id, values };
    const merged = { ...(current ? { fullName: current.fullName, phone: current.phone, address: current.address, isDefault: current.isDefault } : {}), ...values };
    const missingFields = ['fullName', 'phone', 'address'].filter(key => !merged[key as keyof typeof merged]);
    const changed = Object.keys(values).length > 0;
    if (missingFields.length || !changed) return { ...this.reply(missingFields.length ? `Cần bổ sung: ${missingFields.map(f => ({ fullName: 'họ tên', phone: 'số điện thoại', address: 'địa chỉ' })[f]).join(', ')}. Bạn có thể điền biểu mẫu bên dưới.` : 'Hãy nhập thông tin muốn sửa trong biểu mẫu.'), addressForm: { addressId: id, values: merged, missingFields } };
    const errors = await validate(plainToInstance(CreateAddressDto, merged), { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) return { ...this.reply('Thông tin địa chỉ chưa hợp lệ: ' + errors.flatMap(e => Object.values(e.constraints ?? {})).join('. ')), addressForm: { addressId: id, values: merged, missingFields: errors.map(e => e.property) } };
    if (id) await this.addresses.update(userId, id, plainToInstance(UpdateAddressDto, values));
    else await this.addresses.create(userId, plainToInstance(CreateAddressDto, merged));
    state.addressDraft = undefined;
    rows = await this.addresses.list(userId);
    return this.addressReply(rows, state, id ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ.');
  }

  private addressFields(message: string, draft?: AddressDraft): UpdateAddressDto {
    const fields: UpdateAddressDto = {};
    // Explicit labels avoid guessing which part of an address is a recipient name.
    for (const part of message.split(/[;\n]/)) {
      const match = part.match(/^\s*(?:họ tên|tên người nhận|fullName|tên|số điện thoại|điện thoại|sđt|phone|địa chỉ|address)\s*:\s*(.+)$/i);
      if (!match) continue;
      const label = normalizeText(part.split(':')[0]);
      fields[/^(ho ten|ten nguoi nhan|fullname|ten)$/.test(label) ? 'fullName' : /^(so dien thoai|dien thoai|sdt|phone)$/.test(label) ? 'phone' : 'address'] = match[1].trim();
    }
    if (!Object.keys(fields).length && draft && !draft.addressId) {
      const missing = ['fullName', 'phone', 'address'].find(k => !draft.values[k as keyof UpdateAddressDto]);
      const text = message.trim();
      if (missing && !/\b(dia chi|them|tao|sua|cap nhat|doi)\b/.test(normalizeText(text))) fields[missing as 'fullName' | 'phone' | 'address'] = text;
    }
    return fields;
  }

  private async voucher(dto: ChatDto, resolved: InterpretedAction, state: State, userId: number): Promise<ChatReply> {
    let rows = await this.coupons.findAll(userId);
    const cart = await this.cart.get(userId);
    if (resolved.action === 'coupon_detail') {
      const code = dto.code ?? resolved.code ?? this.ordinalId(state.couponCodes, resolved.ordinal) ?? state.viewedCouponCode;
      if (!code) return this.askSelection(state, 'coupon_detail', 'coupons');
      rows = rows.filter(c => c.code.toUpperCase() === code.toUpperCase());
      if (!rows.length) throw new BadRequestException('Không tìm thấy voucher thuộc tài khoản của bạn hoặc voucher dùng chung.');
      state.viewedCouponCode = rows[0].code;
    } else state.couponCodes = rows.map(c => c.code);
    state.userDomain = 'coupons';
    const now = Date.now();
    const coupons: NonNullable<ChatReply['coupons']> = [];
    for (const coupon of rows) {
      const active = coupon.isActive && +new Date(coupon.startDate) <= now && +new Date(coupon.endDate) >= now && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit);
      try {
        const result = await this.coupons.validateCoupon(coupon.code, cart.total, userId);
        coupons.push({ coupon, active, eligible: cart.items.length > 0, reason: cart.items.length ? 'Đủ điều kiện với giỏ hiện tại; chưa áp dụng vào đơn hàng.' : 'Giỏ hàng đang trống.', discountAmount: result.discountAmount, finalAmount: result.finalAmount });
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        coupons.push({ coupon, active, eligible: false, reason: error.message });
      }
    }
    return { ...this.reply(rows.length ? 'Điều kiện voucher được kiểm tra theo giỏ hiện tại. Chưa áp dụng mã vào đơn hàng.' : 'Bạn chưa có voucher.'), coupons, cart,
      actions: rows.map(c => ({ type: 'coupon_detail', label: 'Kiểm tra lại điều kiện', code: c.code })) };
  }

  private async addMany(dto: ChatDto, resolved: InterpretedAction, state: State, userId: number, signal?: AbortSignal) {
    let items = dto.items;
    if (!items) {
      let parts = resolved.items;
      if (!parts) {
        const chunks = dto.message.replace(/(?:thêm|cho tôi|cho mình|vào giỏ hàng|vào giỏ|giúp tôi|giúp mình)/gi, ' ').split(/[,;+]|\s+và\s+/i).map(s => s.trim()).filter(Boolean);
        const parsed = chunks.map(chunk => {
          const match = chunk.match(/^(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+(?:(?:cái|chiếc|sản phẩm)\s+)?(.+)$/i);
          const quantity = match && requestedQuantity(`${match[1]} cái`);
          return match && quantity ? { query: match[2].trim(), quantity } : null;
        });
        if (parsed.every(p => p !== null)) parts = parsed;
        else {
          const semantic = await this.gemini.interpretAction(dto.message, undefined, signal);
          if (semantic?.action === 'cart_add_many') parts = semantic.items;
        }
      }
      if (!parts?.length) return this.reply('Hãy nêu rõ tên và số lượng từng món, ví dụ: “Thêm 2 nồi cơm điện và 1 máy xay sinh tố vào giỏ”.');
      items = [];
      for (const part of parts) {
        const number = [String(part.quantity), ['khong', 'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi'][part.quantity]].filter(Boolean).join('|');
        const name = normalizeText(part.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quantityMentioned = new RegExp(`\\b(?:${number})\\s+(?:(?:cai|chiec|san pham)\\s+)?${name}\\b|\\b${name}\\s+(?:(?:so luong|lay|x|la)\\s+)?(?:${number})\\b`).test(normalizeText(dto.message));
        if (!Number.isInteger(part.quantity) || part.quantity < 1 || part.quantity > 9999 || !quantityMentioned || !normalizeText(dto.message).includes(normalizeText(part.query))) throw new BadRequestException('Chưa xác định được tên và số lượng từng sản phẩm.');
        items.push({ productId: await this.resolveProduct(part.query), quantity: part.quantity });
      }
    }
    signal?.throwIfAborted();
    const cart = await this.cart.addMany(userId, items);
    state.review = undefined;
    return this.cartReply('Đã thêm các sản phẩm vào giỏ hàng.', cart);
  }

  private async resolveProduct(query: string) {
    const context = await this.products.context(`tìm ${query} tồn kho`);
    const rows = context?.products ?? [];
    const exact = rows.filter(p => normalizeText(p.name) === normalizeText(query));
    if (exact.length === 1) return Number(exact[0].id);
    if (rows.length === 1) return Number(rows[0].id);
    throw new BadRequestException(rows.length ? `Có nhiều sản phẩm khớp “${query}”. Hãy tìm và chọn đúng sản phẩm trước.` : `Không tìm thấy sản phẩm “${query}”.`);
  }

  private async confirm(dto: ChatDto, state: State, userId: number): Promise<ChatReply> {
    const pending = state.confirmation;
    if (!pending || pending.expiresAt < Date.now() || (dto.confirmationId && dto.confirmationId !== pending.id)) return this.reply('Không có xác nhận còn hiệu lực. Hãy yêu cầu thao tác lại để xem nội dung trước khi xác nhận.');
    // Explicit button payload must carry the token; natural confirmation is accepted only with the pending flow.
    if (dto.action && dto.confirmationId !== pending.id) return this.reply('Mã xác nhận không hợp lệ. Hãy yêu cầu thao tác lại.');
    state.confirmation = undefined;
    if (pending.type === 'cart_clear') {
      state.userDomain = undefined;
      const cart = await this.cart.clear(userId, pending.items);
      state.review = undefined;
      return this.cartReply('Đã xóa toàn bộ giỏ hàng.', cart);
    }
    const current = (await this.addresses.list(userId)).find(a => a.id === pending.addressId);
    if (!current || addressSnapshot(current) !== addressSnapshot(pending.snapshot)) return this.reply('Địa chỉ đã thay đổi hoặc không còn tồn tại. Hãy xem lại và yêu cầu xóa lần nữa.');
    await this.addresses.remove(userId, pending.addressId, pending.snapshot);
    return this.addressReply(await this.addresses.list(userId), state, 'Đã xóa địa chỉ.');
  }

  private ordinalId<T>(list: T[] | undefined, ordinal?: number): T | undefined {
    return ordinal === undefined ? undefined : list?.[ordinal === -1 ? list.length - 1 : ordinal - 1];
  }
  private askSelection(state: State, action: InterpretedAction['action'], domain: Domain): ChatReply {
    state.pendingSelection = { action, domain }; state.userDomain = domain;
    const listAction: Record<Domain, ChatActionType> = { orders: 'orders_list', addresses: 'addresses_list', favorites: 'favorites_list', coupons: 'coupons_list' };
    return { ...this.reply(`Bạn muốn thao tác với ${labels[domain]} nào? Hãy xem danh sách và chọn đúng mục hoặc nói số thứ tự trong danh sách đó.`), actions: [{ type: listAction[domain], label: `Xem ${labels[domain]}` }] };
  }
  private reply(message: string): ChatReply { return { message, source: 'shopping', intent: 'account', cached: false, type: 'text' }; }
  private addressReply(addresses: NonNullable<ChatReply['addresses']>, state: State, message: string): ChatReply {
    state.addressIds = addresses.map(a => a.id); state.userDomain = 'addresses';
    return { ...this.reply(addresses.length ? message : 'Bạn chưa lưu địa chỉ nào.'), addresses,
      actions: [{ type: 'address_create', label: 'Thêm địa chỉ' }, ...addresses.flatMap(a => [
        { type: 'address_update' as const, label: 'Sửa', addressId: a.id },
        { type: 'address_delete' as const, label: 'Xóa', addressId: a.id },
        ...(!a.isDefault ? [{ type: 'address_default' as const, label: 'Đặt mặc định', addressId: a.id }] : []),
      ])] };
  }
  private confirmationReply(pending: Confirmation): ChatReply {
    return { ...this.reply('Hãy kiểm tra nội dung trước khi xác nhận xóa.'), confirmation: { id: pending.id, summary: pending.summary },
      actions: [{ type: 'action_confirm', label: 'Xác nhận xóa', confirmationId: pending.id }, { type: 'action_cancel', label: 'Hủy' }] };
  }
  private cartReply(message: string, cart: ChatCart): ChatReply {
    const actions: ChatAction[] = cart.items.flatMap(i => [{ type: 'cart_update_quantity', label: 'Đổi số lượng', productId: i.productId }, { type: 'cart_remove', label: 'Xóa', productId: i.productId }]);
    if (cart.items.length) actions.push({ type: 'cart_clear', label: 'Xóa toàn bộ giỏ' });
    return { ...this.reply(message), intent: 'cart_view', cart, type: 'cart', actions };
  }
}
