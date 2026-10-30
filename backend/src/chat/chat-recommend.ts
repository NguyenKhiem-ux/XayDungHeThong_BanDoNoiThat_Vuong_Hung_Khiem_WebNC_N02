// file chứa phần kiểm tra đầu ra tư vấn của Gemini: Gemini chỉ chọn id sản phẩm, server quyết định nội dung được hiển thị.
import { normalizeText } from './chat-matching';

export const MAX_PICKS = 4;
export const MAX_CHIPS = 4;
const MAX_CHIP_LENGTH = 40;

export interface RecommendationDraft {
  intro: string;
  // Rỗng khi Gemini cần hỏi lại khách trước khi chọn (khi đó luôn có followUp).
  picks: Array<{ productId: number; reason: string }>;
  followUp?: string;
  chips: string[];
}

// Giá tiền, phần trăm hoặc cam kết chính sách không được nằm trong lời Gemini; giá luôn hiện trên thẻ sản phẩm lấy từ DB.
// "1.8L", "2000W", "4 người" vẫn được; "1.590.000", "990k", "2 triệu", "giảm 20%" thì không.
const MONEY = /\d[\d.,]*\s*(?:k|nghìn|ngàn|nghin|ngan|triệu|trieu|tr|đồng|dong|đ|vnd|₫|%)(?![\p{L}])|\d{1,3}(?:[.,]\d{3}){1,}(?![\d\p{L}])|\d{5,}(?![\d\p{L}])|[₫$€]|giảm\s*\d|giam\s*\d/iu;
const POLICY = /\b(bao hanh|doi tra|hoan tien|mien phi|giao hang|van chuyen|tra gop|cam ket|chinh sach|freeship)\b/;
// Gemini từng viết giá bằng chữ ("khoảng hai triệu đồng").
const MONEY_WORDS = /\b(trieu|ty|nghin dong|ngan dong|tram nghin|tram ngan|gia re nhat|giam gia)\b/;
const INJECTION = /\b(system prompt|api key|bo qua (chi dan|quy tac)|ignore (previous|instructions))\b/;
const MAX_TEXT = 220;

function safeText(value: unknown) {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  const plain = normalizeText(text);
  if (!text || text.length > MAX_TEXT * 2 || MONEY.test(text) || POLICY.test(plain) || MONEY_WORDS.test(plain)) return '';
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT).replace(/\s+\S*$/, '') + '…' : text;
}

// Chip là câu khách bấm để gửi đi ("Dưới 2 triệu", "Nhà 4 người"), không phải lời shop cam kết,
// nên được nhắc ngân sách; vẫn chặn chính sách, link, prompt injection và câu dài.
function safeChips(value: unknown) {
  if (!Array.isArray(value)) return [];
  const chips = value.flatMap(chip => {
    if (typeof chip !== 'string') return [];
    const text = chip.replace(/\s+/g, ' ').trim();
    const plain = normalizeText(text);
    return text && text.length <= MAX_CHIP_LENGTH && !/https?:|[<>{}]/i.test(text) && !POLICY.test(plain) && !INJECTION.test(plain) ? [text] : [];
  });
  return [...new Set(chips)].slice(0, MAX_CHIPS);
}

// Bỏ id không có trong catalog đã gửi, trùng lặp, hoặc lý do không an toàn; trả null khi không còn gì dùng được.
// allowClarify: cho phép trả lời chỉ gồm câu hỏi lại (picks rỗng); tắt sau một lần hỏi để không hỏi mãi.
export function sanitizeRecommendation(raw: unknown, allowedIds: Set<number>, allowClarify = false): RecommendationDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { intro?: unknown; picks?: unknown; followUp?: unknown; chips?: unknown };
  const seen = new Set<number>();
  const picks = (Array.isArray(value.picks) ? value.picks : []).flatMap(pick => {
    const id = Number((pick as { productId?: unknown })?.productId);
    const reason = safeText((pick as { reason?: unknown })?.reason);
    if (!Number.isSafeInteger(id) || !allowedIds.has(id) || seen.has(id) || !reason) return [];
    seen.add(id);
    return [{ productId: id, reason }];
  }).slice(0, MAX_PICKS);
  const followUp = safeText(value.followUp) || undefined;
  if (!picks.length && !(allowClarify && followUp)) return null;
  return { intro: safeText(value.intro), picks, followUp, chips: safeChips(value.chips) };
}

// Câu có ý mua sắm nhưng bộ phân loại từ khóa không nhận ra (rơi vào unknown): "quà tân gia", "cần đồ nấu cháo".
export function shoppingNeed(message: string) {
  const text = normalizeText(message);
  if (/https?:\/\//i.test(message) || INJECTION.test(text)) return false;
  return /\b(tu van|goi y|nen mua|nen chon|can mua|muon mua|tim mua|tim do|can do|can sam|sam do|sam sua|mua gi|mua do|qua tang|qua tan gia|tang qua|lam qua|do dung|thiet bi|loai nao|cai nao|mon nao)\b/.test(text);
}

export function recommendationMessage(draft: RecommendationDraft, names: Map<number, string>) {
  if (!draft.picks.length) return [draft.intro, draft.followUp].filter(Boolean).join('\n');
  const lines = draft.picks.filter(pick => names.has(pick.productId)).map(pick => `• ${names.get(pick.productId)}: ${pick.reason}`);
  return [draft.intro || 'Mình gợi ý mấy sản phẩm sau theo nhu cầu của bạn:', ...lines, draft.followUp ?? 'Bạn muốn xem kỹ sản phẩm nào, hay thêm luôn vào giỏ?'].join('\n');
}
