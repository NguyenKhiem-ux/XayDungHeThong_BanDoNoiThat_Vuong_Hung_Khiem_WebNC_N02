import { Injectable } from '@nestjs/common';
import { normalizeText } from './chat-matching';
import { ChatIntent } from './chat.types';

@Injectable()
export class SmallTalkService {
  match(message: string): { intent: ChatIntent; message: string } | null {
    const text = normalizeText(message);
    const suffix = '(?: (?:ban|shop|a|nhe|nha|oi|nhieu|rat nhieu))*';
    if (new RegExp(`^(?:xin chao|chao|hello|hi|alo)${suffix}$`).test(text)) {
      return { intent: 'greeting', message: 'Xin chào 👋 Mình có thể giúp bạn tìm sản phẩm hoặc giải đáp về cửa hàng.' };
    }
    if (new RegExp(`^(?:cam on|thank you|thanks|thank|thankiu)${suffix}$`).test(text)) {
      return { intent: 'thanks', message: 'Không có gì nhé 😊 Khi cần tìm đồ gia dụng, cứ hỏi mình!' };
    }
    if (new RegExp(`^(?:tam biet|bye|bai bai|hen gap lai)${suffix}$`).test(text)) {
      return { intent: 'goodbye', message: 'Tạm biệt bạn 👋 Khi nào cần mua đồ gia dụng cứ quay lại nhé!' };
    }
    if (/^(?:(?:ha|hi|he|ho){2,}|k{2,}|lol+|wow+|troi oi|oi|hay qua|dep that|ok|oke|oki|sticker|nhan dan)(?: (?:qua|nhi|nhe|a))*$/.test(text) || !/[\p{L}\p{N}]/u.test(message)) {
      return { intent: 'small_talk', message: 'Hihi 😄 Mình vẫn ở đây nhé! Bạn đang tìm món đồ gì cho nhà mình?' };
    }
    if (/^(?:(?:troi|thoi tiet)(?: hom nay)? dep(?: troi)?(?: that|nhi|qua)?|hom nay vui(?: qua)?|buon ngu(?: qua)?|chan(?: qua)?|(?:toi|minh) (?:doi|dang uong ca phe))$/.test(text)) {
      return { intent: 'small_talk', message: 'Mình nghe bạn nè 😊 Khi nào muốn tìm đồ gia dụng, mình sẵn sàng giúp nhé!' };
    }
    return null;
  }
}
