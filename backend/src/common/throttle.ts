// file khai báo các mức giới hạn tần suất request (rate limit) dùng chung cho các controller.
import { Throttle } from '@nestjs/throttler';

const MINUTE = 60_000;

// Mức chung cho mọi route; từng route nhạy cảm siết riêng bên dưới. Bộ đếm tính theo IP và theo từng route.
export const DEFAULT_THROTTLE = { limit: 120, ttl: MINUTE };
export const THROTTLE_MESSAGE = 'Bạn thao tác quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.';

export const LoginThrottle = () => Throttle({ default: { limit: 10, ttl: 15 * MINUTE } });
export const RegisterThrottle = () => Throttle({ default: { limit: 5, ttl: 60 * MINUTE } });
// OTP 6 số sống 5 phút: 5 lần/15 phút/IP khiến việc dò mã không khả thi.
export const OtpThrottle = () => Throttle({ default: { limit: 5, ttl: 15 * MINUTE } });
// Mỗi tin nhắn có thể tốn một lượt gọi Gemini.
export const ChatThrottle = () => Throttle({ default: { limit: 20, ttl: MINUTE } });
export const EmailTestThrottle = () => Throttle({ default: { limit: 3, ttl: 60 * MINUTE } });
