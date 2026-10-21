import { Injectable } from '@nestjs/common';
import { normalizeText } from './chat-matching';
import { productQuery } from './chat-products.service';
import { ChatIntent, Classification, GeminiDraft, RiskLevel } from './chat.types';
import { SmallTalkService } from './small-talk.service';
import { ChatActionType } from './chat.types';

export function shoppingVerb(text: string) {
  return text.match(/^(?:(?:toi|minh|hay|ban|vui long|giup|cho|muon|lam on|co the|xin)\s+)*(them|luu moi|luu|danh dau|bo|xoa|go|dat|chon|doi|lam|cap nhat|tao|sua)\b/)?.[1];
}

export function shoppingIntent(text: string): Extract<ChatActionType, 'checkout_review' | 'buy_now' | 'cart_remove' | 'cart_update_quantity' | 'cart_add' | 'cart_view' | 'product_select'> | undefined {
  if (/\b(xem lai|kiem tra|tom tat|xac nhan)\b.*\b(mua hang|mua ngay|thanh toan|don hang|tom tat)\b|\b(checkout|xem lai thong tin mua)\b/.test(text)) return 'checkout_review';
  if (/\b(mua ngay|mua luon|lay luon)\b/.test(text)) return 'buy_now';
  if (['bo', 'xoa', 'go'].includes(shoppingVerb(text) ?? '') && /\b(gio|san pham|vua chon|cai|chiec)\b/.test(text)) return 'cart_remove';
  if (/\b(cap nhat|doi|sua|tang|giam)\b.*\b(so luong|cai|chiec|len|xuong)\b|\bso luong\b.*\b(thanh|la)\b/.test(text)) return 'cart_update_quantity';
  if (/\bthem\b/.test(text) && /\b(gio|cai|chiec|san pham|cai nay|hai|mot|ba|bon|nam|sau|bay|tam|chin|muoi|\d+)\b/.test(text)) return 'cart_add';
  if (/\b(xem|kiem tra|tong tien|bao nhieu|gio cua toi)\b.*\bgio\b|\bgio hang\b.*\b(bao nhieu|tong tien)\b|\btong tien\b|^(gio hang|xem gio)$/.test(text)) return 'cart_view';
  if (/\b(chon|toi lay|minh lay)\b/.test(text) && !/\b(nen chon|tu van|nen mua|mau|phoi|phong)\b/.test(text)) return 'product_select';
  return undefined;
}

const NUMBER_WORDS = ['khong', 'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi'];
export function selectedOrdinal(message: string) {
  const text = normalizeText(message);
  const value = text.match(/\bthu\s+(\d+|nhat|mot|hai|ba|tu|bon|nam|sau|bay|tam|chin|muoi)\b/)?.[1] ??
    text.match(/\b(dau tien|cuoi cung)\b/)?.[1];
  if (value === 'cuoi cung') return -1;
  if (value === 'dau tien' || value === 'nhat') return 1;
  if (value === 'tu') return 4;
  return value ? (/^\d+$/.test(value) ? Number(value) : NUMBER_WORDS.indexOf(value)) : undefined;
}

export function requestedQuantity(message: string) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const number = '-?\\d+(?:[.,]\\d+)*|khong|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi';
  const value = text.match(new RegExp(`(?:so luong\\s*(?:thanh|la|len|xuong)?\\s*)(${number})(?=\\s|$|[!?])`))?.[1] ??
    text.match(new RegExp(`so luong\\b.{1,100}?\\b(?:thanh|len|xuong)\\s+(${number})(?=\\s|$|[!?])`))?.[1] ??
    text.match(new RegExp(`(?:^|\\s)(${number})\\s*(?:cai|chiec|san pham)(?=\\s|$|[.!?])`))?.[1] ??
    text.match(new RegExp(`^\\s*(?:them(?: cho (?:toi|minh))?|(?:toi )?(?:muon )?mua ngay)\\s+(${number})\\s*[.!?]?\\s*$`))?.[1] ??
    text.match(new RegExp(`^\\s*(${number})\\s*[.!?]?\\s*$`))?.[1];
  if (!value) return undefined;
  return /^-?\d/.test(value) ? Number(value.replace(',', '.')) : NUMBER_WORDS.indexOf(value);
}

const BUSINESS_RULES: Array<[ChatIntent, RegExp]> = [
  ['password', /\b(mat khau|password|otp)\b/],
  ['refund', /\b(hoan tien|refund|tra tien)\b/],
  ['return', /\b(doi tra|tra hang|doi hang)\b/],
  ['warranty', /\b(bao hanh|bao tri|sua chua)\b/],
  ['shipping', /\b(ship|shipping|giao hang|van chuyen|phi giao|phi ship)\b/],
  ['payment', /\b(thanh toan|chuyen khoan|tra gop|cod|quet ma|payos)\b/],
  ['promotion', /\b(khuyen mai|giam gia|uu dai|coupon|voucher|mien phi|tang qua)\b/],
  ['complaint', /\b(khieu nai|khieu kien|lua dao|hang loi|bi hong|khong hoat dong)\b/],
  ['order', /\b(don hang|dat hang|huy don|mua hang|gio hang)\b/],
  ['account', /\b(tai khoan|dang nhap|dang ky|thong tin ca nhan|bao mat)\b/],
  ['legal', /\b(phap ly|phap luat|hop dong|cam ket|boi thuong)\b/],
];

@Injectable()
export class IntentService {
  constructor(private readonly smallTalk: SmallTalkService) {}

  classify(message: string): Classification {
    const text = normalizeText(message);
    const small = this.smallTalk.match(message);
    if (small) return { intent: small.intent, riskLevel: RiskLevel.LOW, shouldStore: false };
    // No customer-specific secrets, identifiers or order lookups in the shared knowledge base.
    const privateData = /[\w.+-]+@[\w.-]+\.\w+|(?:\+?84|0)\d[\d .-]{7,}|\b(?:otp|password|mat khau|ma don|don hang)\s*[:#]?\s*[a-z]*\d+/i.test(message) ||
      /\b(don hang cua (toi|minh)|kiem tra don|tra cuu don)\b/.test(text) ||
      /\b(mat khau|password|otp)\b.*(?:\d|\b(cua toi|cua minh|la)\b)/.test(text);
    const spam = /(\b\w+\b)(?:\s+\1){5,}/.test(text) || /https?:\/\//i.test(message);
    if (spam || /\b(system prompt|api key|bo qua (chi dan|quy tac)|ignore (previous|instructions)|code python|bong da|nguoi that)\b/.test(text)) {
      return { intent: 'unknown', riskLevel: RiskLevel.LOW, shouldStore: false };
    }
    if (!privateData) {
      const shopping = shoppingIntent(text);
      if (shopping) return { intent: shopping, riskLevel: RiskLevel.HIGH, shouldStore: false };
    }
    for (const [intent, pattern] of BUSINESS_RULES) {
      if (pattern.test(text)) return { intent, riskLevel: RiskLevel.HIGH, shouldStore: !privateData };
    }
    if (privateData) return { intent: 'unknown', riskLevel: RiskLevel.HIGH, shouldStore: false };
    if (/\b(chinh sach|quy dinh|dieu khoan|cam doan)\b/.test(text)) return { intent: 'general_store_question', riskLevel: RiskLevel.HIGH, shouldStore: true };
    // ponytail: deliberately narrow safe-topic allowlist; extend with tested rules, not model confidence alone.
    if (/\b(phong|noi that|nha|khong gian|goc lam viec)\b/.test(text) &&
      /\b(mau|phoi mau|bo tri|sap xep|trang tri|gon gang)\b/.test(text) &&
      !/\b(gia|tien|hang|shop|thuong hieu|ma san pham|dien|hoa chat|chay|an toan)\b/.test(text)) {
      return { intent: 'general_question', riskLevel: RiskLevel.LOW, shouldStore: true };
    }
    let intent: ChatIntent | undefined;
    if (/\b(con hang|het hang|ton kho|con may cai|con bao nhieu)\b/.test(text)) intent = 'product_stock';
    else if (/\b(gia bao nhieu|bao nhieu tien|gia ban|gia cua)\b/.test(text)) intent = 'product_price';
    else if (/\b(danh muc|cac loai san pham)\b/.test(text)) intent = 'product_category';
    else if (productQuery(message).related) {
      intent = /\b(so sanh|khac nhau)\b/.test(text) ? 'product_comparison' :
        /\b(thong so|chi tiet|xuat xu|chat lieu|kich thuoc|xem)\b/.test(text) ? 'product_detail' :
        /\b(tu van|nen chon|nen mua)\b/.test(text) ? 'product_recommendation' : 'product_search';
    } else if (/\b(tim|mua|can|muon)\b/.test(text) && /\b(do|mon|san pham|hang)\b/.test(text)) intent = 'product_search';
    if (intent) return { intent, riskLevel: ['product_price', 'product_stock'].includes(intent) ? RiskLevel.HIGH : RiskLevel.MEDIUM, shouldStore: true };
    if (/\b(lien he|hotline|dia chi|gio lam viec|mo cua|dong cua|chi nhanh|gioi thieu cua hang)\b/.test(text) ||
      (/\b(shop|cua hang|website)\b/.test(text) && /\b(o dau|hoat dong|ho tro|su dung|lien lac|tim kiem)\b/.test(text))) {
      return { intent: 'general_store_question', riskLevel: RiskLevel.HIGH, shouldStore: true };
    }
    return { intent: 'unknown', riskLevel: RiskLevel.LOW, shouldStore: false };
  }

  safeAnswer(answer: string) {
    const text = normalizeText(answer);
    return !BUSINESS_RULES.some(([, pattern]) => pattern.test(text)) &&
      !/\b(shop|cua hang|website|chinh sach|quy dinh|dieu khoan|cam doan|gia|ton kho|con hang|het hang|san pham|thuong hieu|model|vnd|trieu|dong|chac chan|dam bao|chua (co|du) (du lieu|thong tin)|khong (co|du) (du lieu|thong tin)|can (kiem tra|xac minh)|khong biet|dien|hoa chat|api|prompt|database)\b/.test(text) &&
      !/\d|[₫$€]|https?:\/\//.test(answer);
  }

  canAutoApprove(classification: Classification, draft: GeminiDraft) {
    return classification.shouldStore && classification.intent === 'general_question' &&
      classification.riskLevel === RiskLevel.LOW && draft.intent === 'general_question' &&
      this.effectiveRisk(classification, draft) === RiskLevel.LOW && draft.confidence_score >= 85 &&
      draft.should_auto_approve && this.safeAnswer(draft.answer);
  }

  effectiveRisk(classification: Classification, draft: GeminiDraft) {
    const safeGeneral = classification.shouldStore && classification.intent === 'general_question' &&
      classification.riskLevel === RiskLevel.LOW && draft.intent === 'general_question' && this.safeAnswer(draft.answer);
    return safeGeneral ? RiskLevel.LOW : draft.risk_level;
  }
}
