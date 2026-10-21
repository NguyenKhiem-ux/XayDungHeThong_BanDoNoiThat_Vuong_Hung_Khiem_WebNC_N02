# Chatbot thao tác user — Đợt 1

## Phạm vi và API

Các đường dẫn dùng prefix `/api`. Chatbot gọi trực tiếp service nghiệp vụ trong NestJS; frontend tiếp tục dùng `POST /api/chat` với SSE và JWT hiện có.

| Nhóm | API/service đã có | Action mới | Giao diện và giới hạn |
|---|---|---|---|
| Đơn hàng | `GET /orders`, `GET /orders/:id`; OrdersService.listForUser/getOneForUser | `orders_list`, `order_detail` | Thẻ mã/ngày/trạng thái/thanh toán/tổng tiền và chi tiết. Chưa có API user hủy/sửa đơn. |
| Yêu thích | `GET /favorites`, `POST/DELETE /favorites/:productId`; FavoritesService | `favorites_list`, `favorite_add`, `favorite_remove` | ProductCard, nút bỏ yêu thích/thêm giỏ, đồng bộ AuthContext và trang cá nhân. |
| Địa chỉ | `GET/POST /addresses`, `PATCH/DELETE /addresses/:id`; AddressesService, Create/UpdateAddressDto | `addresses_list`, `address_create`, `address_update`, `address_delete`, `address_default` | Danh sách, biểu mẫu, sửa/xóa/đặt mặc định. Entity không có nhãn “nhà/công ty”; tên gọi mơ hồ cần chọn lại. |
| Voucher | `GET /coupons`, `POST /coupons/validate`; CouponsService.findAll/validateCoupon | `coupons_list`, `coupon_detail` | Điều kiện, thời hạn, mức giảm và lý do chưa đủ điều kiện. Tổng tiền lấy từ CartService. Chỉ kiểm tra, chưa áp mã. |
| Giỏ | `GET /cart`, `POST /cart/add`, `PUT /cart/update`, `DELETE /cart/remove/:id`, `DELETE /cart/clear`; CartService | `cart_add_many`, `cart_clear` | Giữ action giỏ cũ; thêm nhiều món và xác nhận xóa toàn giỏ. |
| Xác nhận | Context phiên server | `action_confirm`, `action_cancel` | Token, nội dung đã xem và thời hạn 5 phút. |

Không thêm REST endpoint, dependency hay migration. Bổ sung CartService.addMany để kiểm tra toàn bộ lô và ghi trong một transaction; add dùng lại phương thức này. clear nhận snapshot tùy chọn và kiểm tra trong transaction có khóa giỏ. AddressesService.remove nhận snapshot tùy chọn, kiểm tra lại trong transaction có khóa trước khi xóa; REST cũ vẫn gọi được như trước.

## Luồng và bảo mật

- ChatUserActionsService nối hội thoại với service hiện có, không tính lại nghiệp vụ voucher/giỏ/đơn hàng.
- Câu rõ ràng dùng shortcut; Gemini structured output phân loại/trích xuất cách nói khác. Model chỉ nhận yêu cầu hiện tại và tên chủ đề, không nhận hồ sơ/đơn/địa chỉ đã lưu hoặc toàn bộ lịch sử. Backend kiểm tra allowlist, kiểu dữ liệu, tên/số lượng có trong yêu cầu, dữ liệu thật và quyền sở hữu.
- Action tài khoản chạy trước Knowledge. Kết quả tài khoản/thao tác không được lưu vào Knowledge chung. Giữ bộ lọc FAQ/chính sách cũ.
- Tách orderIds/viewedOrderId, addressIds, favoriteIds, couponCodes/viewedCouponCode, draft địa chỉ và xác nhận khỏi context sản phẩm. Đổi chủ đề không tiếp tục bước nhập số lượng/biểu mẫu cũ.
- Tài khoản lấy từ JWT. Client gửi userId/field lạ bị ValidationPipe từ chối, kể cả DTO lồng nhau. Order detail dùng kiểm tra chủ đơn. Địa chỉ phải nằm trong danh sách của user và service vẫn kiểm tra `{id,userId}`. Voucher chỉ lấy mã riêng của user hoặc mã dùng chung.
- Xóa địa chỉ/giỏ chỉ tạo bản xem trước; cần bấm xác nhận hoặc nói xác nhận trong đúng flow. Token gắn tài khoản/phiên; hết hạn hoặc snapshot thay đổi phải yêu cầu lại. Có thể hủy bằng nút hoặc hội thoại.
- Giữ requestId và hàng đợi theo user chống thực thi lặp khi retry. Thêm nhiều món không ghi từng phần khi một món thiếu/hết hàng. Giá/tổng/mức giảm lấy từ service backend.
- Phân biệt cần đăng nhập, không có quyền, không tìm thấy, validation và lỗi hệ thống. Không trả thành công trước khi service hoàn tất.
- Chặn dấu hiệu mật khẩu/OTP/PIN/token/JWT/API key/thông tin thẻ phổ biến trước khi gửi mạng hoặc thêm tin nhắn vào lịch sử frontend; backend chặn trước fingerprint/context. Không log nội dung nhạy cảm. Bộ lọc không nhận biết được mọi chuỗi bí mật không có nhãn; không nhập thông tin xác thực vào chat.
- Giữ generateContentStream, SSE controller, bộ đọc SSE và createTextQueue. Không đổi tốc độ trong frontend/src/api/chat-stream.ts. Thẻ nghiệp vụ nằm trong result; Gemini vẫn cập nhật bằng delta thật.

## File thay đổi

Backend (đường dẫn tính từ backend/):

- src/chat/chat-user-actions.service.ts: định tuyến, context, biểu mẫu, xác nhận và gọi service.
- src/chat/chat.service.ts: action trước Knowledge, chặn secret trước context, thống kê lượt phân loại Gemini.
- src/chat/gemini.service.ts: phân loại/trích xuất JSON schema và validation đầu ra.
- src/chat/chat.types.ts, src/chat/dto/chat.dto.ts: action/payload và validation lồng nhau.
- src/chat/chat.module.ts: nối module nghiệp vụ sẵn có.
- src/chat/chat-products.service.ts: nút yêu thích.
- src/chat/chat-shopping.service.ts, src/chat/intent.service.ts: nút xóa giỏ, giữ tên sản phẩm có chữ “gỗ”, đọc số lượng trong câu có tên sản phẩm và tránh nhầm danh từ với động từ.
- src/cart/cart.service.ts: batch trong transaction, snapshot trước khi xóa toàn giỏ.
- src/addresses/addresses.service.ts: snapshot và khóa trước khi xóa địa chỉ.
- src/favorites/favorites.module.ts: export service cho ChatModule.
- src/chat/user-actions.spec.ts: test phase 1 với service thật và repository fixture.
- src/chat/chat.spec.ts, src/chat/shopping.spec.ts: nối dependency mới cho các suite cũ.
- scripts/verify-chatbot.cjs, scripts/verify-shopping.cjs: cập nhật constructor ở script kiểm chứng chức năng cũ; chưa dùng hai script này để kiểm chứng phase 1.
- package.json: thêm suite phase 1 vào test:chat.

Frontend (đường dẫn tính từ frontend/):

- src/api/types.ts: kiểu request/response/action. services.ts đã truyền được payload nên không cần sửa.
- src/components/ChatAccountCards.tsx: thẻ đơn/địa chỉ/voucher/yêu thích, biểu mẫu và xác nhận.
- src/components/ChatWidget.tsx: nối thẻ/shortcut, đồng bộ context, chặn secret trước lịch sử.
- src/context/AuthContext.tsx: đồng bộ yêu thích, tránh fetch ban đầu ghi đè kết quả chat mới.
- src/pages/ProfilePage.tsx: cập nhật địa chỉ khi chatbot thay đổi.
- src/styles/chat-widget.css: biểu mẫu và shortcut.
- scripts/chat-stream.test.mjs, package.json: test bộ đọc SSE và queue hiện có.

Tài liệu: CHATBOT-PHASE1.md và liên kết bổ sung trong CHATBOT.md.

## Kiểm thử

Test phase 1 dùng fixture trong bộ nhớ, không đọc .env, không kết nối MySQL hoặc sửa dữ liệu thật. Gemini được mock, có generator chờ để xác nhận delta đến trước khi model hoàn thành.

| Thư mục | Lệnh | Kết quả |
|---|---|---|
| backend | `npm.cmd run build` | PASS |
| backend | `npm.cmd run test:chat` | 50 test PASS |
| backend | `npm.cmd run test:addresses` | 1 test PASS |
| frontend | `npm.cmd run build` | PASS |
| frontend | `npm.cmd run test:chat` | 6 test PASS |

Bao phủ đủ 10 tình huống yêu cầu. Có thêm batch atomic/retry, đổi chủ đề, số lượng tiếng Việt, tham chiếu yêu thích, snapshot cũ, giữ tiếng Việt/Markdown/emoji và abort/cancel queue.

Frontend build cảnh báo Vite CJS và bundle trên 500 kB; Node test cảnh báo API experimental, không phải lỗi build/test.

## Giới hạn và kiểm tra thủ công

- Context/idempotency ở RAM, TTL phiên 30 phút, tối đa 1.000 phiên/100 requestId mỗi phiên theo cơ chế cũ. Reload trang tạo session mới; restart backend mất context. Cần kho phiên chung trước khi chạy nhiều backend instance.
- Chưa kiểm tra trình duyệt hoặc Gemini/MySQL thật trong đợt này. Cần kiểm tra bố cục mobile, đồng bộ tim yêu thích/giỏ/trang cá nhân và câu diễn đạt đa dạng trên tài khoản thử nghiệm được phép dùng.
- Hủy kết nối bỏ queue và chặn kết quả cũ trên giao diện. Transaction đã bắt đầu ở server có thể hoàn tất; hủy hiển thị không hoàn tác dữ liệu. Retry cùng requestId không thực thi lại trong phiên còn hiệu lực.
- Thiếu/mơ hồ thì yêu cầu chọn hoặc điền thêm. Gemini không khả dụng thì shortcut/nút vẫn dùng được; yêu cầu cần phân loại thêm có thể phải diễn đạt rõ hơn.
- Chưa triển khai Đợt 2: đặt đơn/checkout hoàn chỉnh, đổi thanh toán, hồ sơ/thẻ hoặc hủy/sửa đơn.
