# Trợ lý mua sắm — cập nhật ngày 21/10/2026

Bổ sung Đợt 1: [thao tác user, API tái sử dụng, file thay đổi, kiểm thử và giới hạn](CHATBOT-PHASE1.md).

Chatbot đã nối vào nghiệp vụ thật: tìm → chọn → thêm/sửa/xóa/xem giỏ → xem trước mua ngay → xác nhận tóm tắt → tiếp tục checkout. Giá, tồn kho và tổng tiền đều lấy/tính ở backend. Không có lệnh tạo đơn hoặc thu tiền trong chatbot.

## Các luồng hiện tại

| Thao tác | Cách xử lý |
| --- | --- |
| Tìm kiếm | `ChatProductsService`, truy vấn MySQL có tham số, tối đa 5 sản phẩm; lọc tên/từ khóa/danh mục/nhãn hiệu/ngân sách. “Tất cả sản phẩm” duyệt catalog thật. |
| Chọn sản phẩm | Nút chọn, tên không mơ hồ hoặc “Tôi lấy cái thứ hai”; thứ tự dựa trên kết quả tìm gần nhất ở server. Tìm mới xóa lựa chọn cũ, kể cả khi không có kết quả. |
| Giá/tồn kho/so sánh | Đọc lại ID thật từ database; câu “sản phẩm này” dùng lựa chọn hiện tại. Giữ intent `product_comparison` hiện có. |
| Mẫu rẻ hơn | Dùng tiêu chí tìm trước/loại sản phẩm đã chọn, giới hạn giá thấp hơn giá hiện tại. |
| Thêm/sửa/xóa/xem giỏ | Dùng lại `CartService`, cùng dữ liệu và phép tính với `/api/cart`; hỗ trợ “Thêm cho tôi hai cái”, “Đổi số lượng thành 3”, “Bỏ sản phẩm vừa chọn đi”, “Tôi muốn xem lại giỏ”, “Xem tổng tiền”. |
| Chưa rõ số lượng | Hỏi số lượng, nhớ thao tác chờ ở server và nhận câu trả lời tiếp theo, ví dụ “3”. |
| Mua ngay | Kiểm tra lại sản phẩm/tồn kho; xem trước sản phẩm đã chọn với số lượng yêu cầu **cùng các sản phẩm khác đang trong giỏ**, phù hợp checkout hiện có. Chưa thêm giỏ khi chỉ xem trước. |
| Xác nhận tóm tắt | Nút xác nhận kèm ID bản tóm tắt, kiểm tra lại giá/tồn kho/giỏ/địa chỉ. Thay đổi thì yêu cầu xem và xác nhận lại. Thành công mới đặt số lượng dòng sản phẩm trong giỏ về đúng số đã duyệt và cung cấp link `/checkout/info`. |
| Thông tin nhận hàng | Chỉ liệt kê địa chỉ thuộc tài khoản hiện tại qua `AddressesService.list`. Địa chỉ được chọn điền trước vào checkout; người dùng hoàn thiện quận/huyện, tỉnh/thành phố, thông tin thiếu và phương thức thanh toán tại đó. |

Small talk, FAQ đã duyệt, Gemini/RAG, quản trị Knowledge và các bộ lọc hiện có vẫn được giữ. Các thao tác mua sắm không gửi sang Gemini hoặc ghi vào Knowledge dùng chung.

## API và bảo mật

Vẫn dùng `POST /api/chat`. Request gồm `message`, `sessionId`, `requestId` và tùy thao tác: `action`, `productId`, `quantity`, `reviewId`, `addressId`. Các action hỗ trợ là `product_select`, `cart_add`, `cart_remove`, `cart_update_quantity`, `cart_view`, `buy_now`, `checkout_review`, `checkout_confirm`.

Response bổ sung `type`, `actions`, `cart`, `checkout`, `checkoutUrl`, `error`; giữ nguyên `message`, `source`, `intent`, `cached`, `products` và `knowledgeId`. Response lỗi nghiệp vụ vẫn dùng HTTP 4xx/5xx của Nest; widget hiển thị thông báo backend. Chưa đăng nhập nhận `LOGIN_REQUIRED` và link đăng nhập.

- `OptionalJwtAuthGuard` cho phép câu hỏi sản phẩm công khai, nhưng token đã gửi phải qua `JwtStrategy` hiện có; token sai/hết hạn trả 401. Mọi thao tác giỏ/mua ngay yêu cầu user đã xác thực. Không nhận `userId` từ body.
- DTO từ chối action không hỗ trợ, số âm/số thập phân/ID sai và field ngoài danh sách. Số lượng mua sắm là số nguyên 1–9999.
- ID nút phải thuộc kết quả hiện tại hoặc giỏ của chính user; sản phẩm được đọc lại từ database trước hành động. Các dòng giỏ luôn truy vấn theo `cartId` lấy từ user JWT.
- `CartService` kiểm tra số nguyên an toàn và tồn kho; thao tác ghi dùng transaction, khóa dòng cart và khóa đọc sản phẩm. Logic dùng chung áp dụng cho cả chatbot lẫn trang giỏ.
- Thao tác thay đổi giỏ/xác nhận bắt buộc `requestId`. Server giữ kết quả theo phiên và nội dung request, tuần tự hóa request của cùng user, từ chối tái sử dụng ID cho nội dung khác. Retry sau lỗi mạng giữ cùng ID; UI chặn bấm liên tục và vô hiệu hóa nút của phản hồi cũ.
- Widget và CartContext tách theo tài khoản; phản hồi đang bay của tài khoản trước không được cập nhật vào tài khoản sau. CartContext nhận trực tiếp snapshot backend sau thành công.
- Giá, tồn kho và tổng tiền của client/model không được dùng để quyết định giao dịch. Không SQL do AI tạo, không log token hoặc dữ liệu nhận hàng. Không thay đổi payment/webhook/OrderService.

## Ngữ cảnh và giới hạn

Ngữ cảnh lưu RAM theo `(user JWT hoặc guest, sessionId)`, TTL 30 phút không hoạt động, tối đa 1000 phiên và 100 request có ID mỗi phiên. Nhớ kết quả gần nhất, sản phẩm chọn, số lượng, thao tác cuối, câu hỏi số lượng đang chờ và bản tóm tắt. Nút bắt đầu cuộc trò chuyện mới tạo ID phiên mới.

Đây là phương án cho một backend instance hiện tại. Cần chuyển session, khóa request và kết quả chống lặp sang kho dùng chung trước khi chạy nhiều instance. Restart/hết hạn sẽ mất ngữ cảnh: chatbot yêu cầu chọn lại, không lấy lịch sử/giá do client gửi để tái tạo thao tác. Chống lặp không phải cam kết lưu bền qua restart.

Schema Product hiện không có biến thể hay cờ hoạt động; kiểm tra khả dụng dựa vào sản phẩm tồn tại và tồn kho. Nhận diện câu tiếng Việt dùng rule hiện có được mở rộng; cách nói chưa rõ phải chọn lại/nhập số cụ thể. Chưa có giữ hàng trong giai đoạn xem trước. Tổng tiền là tạm tính trước coupon; checkout hiện có xác thực giá và coupon khi người dùng đặt hàng.

Phạm vi mua ngay đã hoàn thành tới xem/xác nhận bản tóm tắt. Chatbot không tự tạo đơn, gọi payment hoặc thu tiền; các bước đó vẫn cần thao tác rõ ràng ở checkout.

## File thay đổi trong lần nâng cấp này

File mới:

- `backend/src/chat/chat-shopping.service.ts`: thao tác giỏ, chọn sản phẩm, ngữ cảnh mua hàng và xác nhận tóm tắt.
- `backend/src/common/guards/optional-jwt-auth.guard.ts`: xác thực tùy chọn cho câu hỏi công khai, kiểm tra nghiêm token được cung cấp.
- `backend/src/chat/shopping.spec.ts`: kiểm thử intent, CartService, HTTP, quyền truy cập, lỗi, chống lặp và thay đổi giỏ lúc xác nhận.
- `backend/scripts/verify-shopping.cjs`: kiểm thử MySQL thật bằng bảng tạm của riêng kết nối.

File sửa:

- `backend/src/chat/chat.controller.ts`, `chat.module.ts`, `chat.service.ts`: kết nối JWT, Cart/Addresses, điều phối và phiên có phạm vi theo tài khoản.
- `backend/src/chat/chat-products.service.ts`, `intent.service.ts`, `chat.types.ts`, `dto/chat.dto.ts`: tra ID, intent, tham chiếu thứ tự/số lượng, kiểu request/response.
- `backend/src/cart/cart.service.ts`, `backend/src/addresses/addresses.module.ts`: kiểm tra/khóa ghi dùng chung và export service địa chỉ.
- `backend/src/chat/chat.spec.ts`, `backend/scripts/verify-chatbot.cjs`, `backend/package.json`: cập nhật caller và lệnh test.
- `frontend/src/api/types.ts`, `services.ts`: contract và action của chat.
- `frontend/src/components/ChatWidget.tsx`, `frontend/src/styles/chat-widget.css`: thẻ tương tác, giỏ, tổng tiền, địa chỉ, xác nhận, retry và phiên mới; CSS giới hạn trong widget.
- `frontend/src/context/CartContext.tsx`: đồng bộ snapshot backend, tránh lộ snapshot cũ khi chuyển tài khoản.
- `frontend/src/pages/CheckoutPage.tsx`: nhận địa chỉ đã chọn, chờ tải giỏ và giữ thứ tự React hooks ổn định.
- `CHATBOT.md`: báo cáo và hướng dẫn vận hành.

Không thêm dependency, không sửa `.env`, không sửa cấu hình payment/webhook.

## Kiểm thử thực tế ngày 21/10/2026

- Backend build: PASS.
- Frontend build: PASS; còn cảnh báo Vite CJS deprecation có sẵn.
- `npm.cmd run test:chat`: **35 tests PASS**; gồm các test chatbot cũ và các test mua sắm mới.
- Address/Auth: **2 tests PASS** bằng `node --test -r ts-node/register src/addresses/addresses.service.spec.ts src/auth/auth.service.spec.ts`.
- `node scripts/verify-chatbot.cjs --migration`: migration bảng tạm PASS. Lượt đầu phát hiện bảng thật thiếu 8 cột metadata và trả 503; đã xử lý bằng migration sẵn có.
- `npm.cmd run db:chatbot`: PASS, backfill metadata 7 bản ghi, ẩn 3 mục giá trị thấp; không xóa. Fingerprint xác nhận câu hỏi/câu trả lời/keys/lượt dùng/timestamps của 7 bản ghi giữ nguyên.
- `node scripts/verify-chatbot.cjs` sau migration: PASS trên MySQL thật, dữ liệu thử được rollback.
- `npm.cmd run test:shopping:mysql`: PASS với repository và khóa transaction MySQL thật. Tra catalog thật theo chế độ đọc; ghi fixture chỉ vào bảng TEMPORARY `products`, `carts`, `cart_items`, `user_addresses` của kết nối kiểm thử, rollback và dọn bảng tạm sau chạy. Không sửa cart/product/address của khách hàng.
- Chrome headless: PASS desktop 1280×900 và mobile 390×844; hiển thị 5 sản phẩm từ catalog thật, nút thao tác có thể bấm, chọn “chiếc thứ hai”, khách chưa đăng nhập được yêu cầu đăng nhập, không tràn ngang hoặc có lỗi JavaScript. Request API trong phép thử browser được chuyển về backend localhost bằng DevTools, không sửa `.env` hay cấu hình URL của dự án.

Chưa thử tạo đơn/thu tiền hoặc gọi Gemini thật trong lần này. Browser kiểm tra phiên khách; quyền và thao tác tài khoản đăng nhập đã được kiểm tra ở bộ HTTP và MySQL.

## Chạy và kiểm tra lại

Hai terminal ở thư mục dự án:

```powershell
cd backend
npm.cmd run start:dev
```

```powershell
cd frontend
npm.cmd run dev
```

Giữ cấu hình DB/JWT/Gemini/API hiện có. Migration đã chạy trên DB đang cấu hình; với môi trường khác còn schema cũ, build backend rồi chạy `npm.cmd run db:chatbot` trước khi chạy bản mới.

Đăng nhập và thử chuỗi: “Tất cả sản phẩm” → “Tôi lấy cái thứ hai” → “Thêm cho tôi hai cái” → “Xem tổng tiền” → “Đổi số lượng thành 3” → “Mua ngay” → kiểm tra địa chỉ/tổng tiền → bấm xác nhận → tiếp tục checkout. Dùng loại sản phẩm thực tế trong DB khi thử tìm theo ngân sách. Đối chiếu giỏ chatbot với `/cart`.

Để chạy toàn bộ kiểm thử lần này, trong `backend`:

```powershell
npm.cmd run build
npm.cmd run test:chat
node --test -r ts-node/register src/addresses/addresses.service.spec.ts src/auth/auth.service.spec.ts
node scripts/verify-chatbot.cjs
npm.cmd run test:shopping:mysql
```

Trong `frontend`: `npm.cmd run build`.

---

# Lịch sử: nâng cấp Knowledge Base trước phiên bản trợ lý mua sắm

Các mục bên dưới mô tả lần nâng cấp cũ; phạm vi file và kết quả kiểm thử hiện tại nằm ở phần cập nhật phía trên.

## 1. File đã sửa

- `backend/src/chat/chat.service.ts`: điều phối small talk → Knowledge → sản phẩm → Gemini/draft.
- `backend/src/chat/chat.module.ts`: đăng ký các service bổ sung.
- `backend/src/chat/chat-products.service.ts`: trả dữ liệu thật bằng template; hỏi lại nếu chưa biết sản phẩm; tra cả sản phẩm hết hàng khi hỏi tồn kho.
- `backend/src/chat/knowledge.service.ts`: lọc giá trị, metadata, tự duyệt có điều kiện, chống trùng, thống kê DB, kiểm tra freshness sản phẩm, audit duyệt.
- `backend/src/chat/knowledge.controller.ts`: người duyệt lấy từ JWT hiện tại.
- `backend/src/chat/dto/knowledge.dto.ts`: filter trạng thái/risk/intent và tương thích query status cũ.
- `backend/src/database/entities/chatbot-knowledge.entity.ts`: bổ sung metadata, tách bảng chatbot khỏi synchronize tự động.
- `backend/src/chat/chat.spec.ts`: cập nhật bộ test HTTP, phân loại, SQL, phân quyền và các lỗi.
- `backend/scripts/setup-chatbot.cjs`: migration bổ sung, chạy lại an toàn, đối chiếu fingerprint dữ liệu.
- `backend/scripts/verify-chatbot.cjs`: test MySQL thật, migration bằng bảng tạm và tùy chọn Gemini thật.
- `database/chatbot_knowledge.sql`: schema cho cài đặt mới.
- `frontend/src/api/types.ts`, `frontend/src/api/knowledge.ts`: metadata, response, filter.
- `frontend/src/pages/admin/ChatbotKnowledgePage.tsx`, `frontend/src/styles/chatbot-knowledge.css`: nâng cấp trang Admin đang có.
- `CHATBOT.md`: báo cáo và cách vận hành.

Không sửa Authentication/User/Product/Cart/Order/Payment/Coupon/Forgot password, API nghiệp vụ, widget khách hàng hoặc bố cục website.

## 2. File mới và package

Bốn file mới, đều thuộc ChatModule hiện có:

- `backend/src/chat/chat.types.ts`
- `backend/src/chat/intent.service.ts`
- `backend/src/chat/small-talk.service.ts`
- `backend/src/chat/gemini.service.ts`

Không thêm dependency. Tận dụng `@google/genai`, NestJS, TypeORM, MySQL, JWT, Axios và công cụ test đã cài. Theo nguyên tắc Ponytail, không thêm classifier AI, vector database, Redis, hàng đợi, bảng hội thoại, training hoặc fine-tuning.

## 3. Database migration

Dùng lại bảng `chatbot_knowledge`; không tạo hệ thống/bảng Knowledge thứ hai.

Bổ sung `normalized_question`, `intent`, `confidence_score`, `risk_level`, `source`, `should_store`, `reviewed_by`, `reviewed_at`. Giữ khóa unique `(question_key, context_hash)`, question/answer/keywords/usage/timestamps cũ.

Migration mở rộng enum trước, chuyển `pending` → `pending_review`, rồi thu enum về `pending_review|approved|rejected`. Không xóa bản ghi. Nội dung không hữu ích có sẵn được giữ nhưng đặt `should_store=false`, không hiển thị trong danh sách Admin và không tái sử dụng. Không gán giả người/ngày duyệt cho dữ liệu cũ; nguồn cũ không xác định là `system`, confidence 0.

Chỉ entity chatbot dùng `synchronize:false`, ngăn TypeORM tự ép enum trước migration. Cấu hình synchronize và schema các bảng khác không thay đổi.

Đã chạy trên DB hiện tại ngày 29/09/2026: backfill 1 bản ghi; fingerprint xác nhận câu hỏi, câu trả lời, khóa, lượt dùng và timestamps không đổi. Lần chạy thứ hai: backfill 0, dữ liệu giữ nguyên. Cũng đã kiểm thử pending/approved/rejected và small talk cũ trên bảng TEMPORARY riêng của kết nối; không tạo bảng test tồn tại lâu dài.

Khi deploy: dừng backend phiên bản cũ, backup DB theo quy trình vận hành, build rồi chạy migration, sau đó khởi động bản mới. MySQL DDL không có rollback transaction đầy đủ; script idempotent cho phép chạy lại nếu gián đoạn.

## 4. Flow mới

`POST /api/chat → trim/chuẩn hóa → rule intent/risk/value → nhánh xử lý`

| Nhánh | Phản hồi | Gọi Gemini / lưu Knowledge |
| --- | --- | --- |
| Small talk/greeting/thanks/goodbye | Template tiếng Việt | Không / không |
| Ngoài phạm vi, spam, thông tin riêng | Chuyển hướng lịch sự/an toàn | Không / không |
| Approved Knowledge khớp | Nội dung đã duyệt, tăng usage_count | Không / không tạo mới |
| Sản phẩm | Query MySQL, template từ dữ liệu thật | Không / không lưu snapshot dư thừa |
| General LOW thuộc allowlist | Gemini JSON, qua kiểm tra nội dung | Một lần / approved hoặc pending_review |
| Chính sách/HIGH chưa có Knowledge | Chỉ thông báo an toàn cho khách | Một lần tạo draft / pending_review |
| Câu đã pending/rejected cùng khóa | Thông báo chờ xác minh, không dùng answer cũ | Không / không tạo trùng |

Kiến thức sản phẩm chỉ tái dùng sau khi hash dữ liệu hiện tại khớp. Với nhánh cần Gemini, tối đa 3 mục Knowledge đã duyệt được truy hồi và nhúng vào payload `context`; nội dung được đánh dấu là dữ liệu tham khảo, không phải chỉ dẫn. Tìm kiếm sản phẩm giới hạn 5 kết quả, SQL parameterized. Ngân sách “dưới 2 triệu” dùng trần <= 2.000.000 theo yêu cầu mới. Không biết tên/loại sản phẩm thì hỏi lại, không tự chọn một sản phẩm bất kỳ. Khi không có kết quả, nói rõ chưa tìm thấy.

## 5. Small talk

`SmallTalkService` dùng regex toàn câu và template cho haha/hihi/hehe/kkkk/lol, chào/cảm ơn/tạm biệt, thời tiết, buồn ngủ, đói, cà phê, emoji và sticker đơn giản. Nhánh này không truy cập DB, không gọi Gemini, không tạo pending.

Không dùng độ dài câu để phân loại. “Có ship không?” là shipping HIGH; “Giá bao nhiêu?” là product_price và cần xác định sản phẩm. Lời chào kèm câu hỏi kinh doanh không bị nuốt thành small talk.

## 6. Intent và lọc giá trị

Danh sách: small_talk/greeting/thanks/goodbye; product_search/detail/recommendation/comparison/price/stock/category; shipping/payment/promotion/warranty/return/refund/order/complaint/account/password/legal; general_store_question/general_question/unknown.

Rule xác định intent trước Gemini. Phân loại của model không được ghi đè intent/risk phía server để hạ rủi ro.

Không lưu xã giao, spam lặp, link spam, câu ngoài phạm vi hoặc câu chứa email/số điện thoại/mã đơn/mật khẩu/OTP theo các mẫu nhận diện. Câu hỏi cá nhân về đơn hàng được hướng về tài khoản/đơn hàng/hỗ trợ; không làm Knowledge dùng chung. Bộ lọc rule không phải hệ thống DLP hoàn chỉnh: không nên gửi bí mật qua chatbot.

Admin tạo/sửa FAQ cũng phải đi qua bộ lọc này. Khả năng nhận diện vẫn là rule tiếng Việt có giới hạn, chưa phải hiểu ngữ nghĩa mọi cách diễn đạt.

## 7. Confidence

Gemini phải trả JSON gồm `answer`, `intent`, `confidence_score` (số nguyên 0–100), `risk_level`, `should_auto_approve`.

Backend kiểm tra schema, kiểu/giá trị và nội dung trả về; JSON rỗng/sai/không đầy đủ bị từ chối với lỗi 503 thân thiện, không lưu dữ liệu lỗi. Confidence là tự đánh giá của model, không phải xác suất đúng đã hiệu chuẩn.

## 8. Risk

- LOW: xã giao và một allowlist hẹp về phối màu/bố trí/trang trí nhà.
- MEDIUM: tìm kiếm, thông tin, tư vấn và so sánh sản phẩm.
- HIGH: chính sách, thanh toán, shipping, bảo hành, đổi trả/hoàn tiền, order, account/password, khiếu nại, pháp lý, cam kết; giá/tồn kho cần xác minh.

Giá/tồn kho HIGH vẫn được trả trực tiếp khi đã có dữ liệu MySQL. Với draft mới, risk có thể tăng theo kết quả model/nội dung, không được giảm so với rule. Nội dung có cam kết, giá, kho, thông tin thiếu xác minh bị giữ lại để duyệt.

## 9. Khi gọi Gemini

Chỉ khi câu có giá trị, chưa có Knowledge hợp lệ, không thể trả bằng template/DB, và chưa có bản ghi pending/rejected cùng khóa.

Giữ model `gemini-3.5-flash-lite` hiện có. Model được Google liệt kê với Free Tier; quota thực tế phụ thuộc dự án. Nguồn: [bảng giá Google](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).

Dùng structured output của SDK đã cài, giới hạn 900 token đầu ra, timeout 15 giây, một lần thử mỗi request, không retry vô hạn. Gemini nhận tối đa 3 approved Knowledge context đã cắt độ dài trước khi gửi. [Tài liệu JSON schema](https://ai.google.dev/gemini-api/docs/structured-output).

## 10. Khi lưu Knowledge

Lưu draft Gemini hợp lệ của câu có giá trị, hoặc FAQ do Admin tạo. Không lưu các phản hồi template và kết quả SQL động chỉ để tạo thêm việc duyệt.

Cùng question_key/context_hash không ghi đè nội dung/quyết định Admin. Sửa câu trả lời đưa về pending_review, xóa audit duyệt cũ và chuyển source thành admin. Approve/reject ghi reviewed_by từ JWT, reviewed_at từ server.

Khách không nhận draft HIGH. Chỉ thông báo “đã ghi nhận” khi việc lưu thành công/đã tồn tại bản ghi; nếu DB write lỗi thì nói rõ chưa lưu được.

## 11. Auto approve

Tất cả điều kiện phải đúng:

- Rule: should_store=true, intent=general_question trong allowlist, risk LOW.
- Gemini: đúng intent general_question, risk LOW, confidence >=85, should_auto_approve=true.
- Câu trả lời qua bộ lọc: không chính sách/cam kết/giá/tồn kho/brand/model, không số liệu cần xác minh hoặc thông báo thiếu dữ liệu.

Đây là cổng duyệt bảo thủ, không phải chứng minh AI luôn đúng. Ví dụ general decor có số thứ tự hoặc con số cũng có thể bị giữ để review. HIGH không tự duyệt kể cả confidence=99.

## 12. Pending review và Admin

HIGH/business luôn draft-only nếu chưa có approved Knowledge. General không đủ tiêu chuẩn tự duyệt cũng vào pending; câu trả lời LOW an toàn có thể được hiển thị lần đầu, nhưng pending/rejected không được dùng lại cho khách.

Admin giữ trang `/admin/chatbot/knowledge`: All/Pending/Approved/Rejected, lọc Risk/Intent; hiển thị question, answer, intent, confidence, risk, source, status, usage, created/reviewed dates. Giữ Create/Edit/Approve/Reject/Delete và JWT/ADMIN hiện tại. Delete vẫn là thao tác xóa vĩnh viễn do Admin xác nhận.

Thống kê totalQuestions/knowledgeHits/geminiCalls/smallTalkHandled/autoApproved/productQueries/errors tính theo tiến trình kể từ since, reset khi restart. totalQuestions là số tin nhắn hợp lệ, không phải số hội thoại riêng biệt. pendingReview/rejected và usage_count lấy từ DB. Hai tỷ lệ dùng totalQuestions làm mẫu số; Gemini calls tính cả lần gọi lỗi.

## 13. Giảm Gemini token

Rule và template chạy trước; Knowledge approved tái dùng có kiểm tra; giá/kho/sản phẩm trả bằng SQL, không qua Gemini. Câu pending/rejected lặp không tạo draft mới. Chỉ gửi tối đa 3 mục Knowledge liên quan, không gửi toàn bộ catalog/KB/lịch sử chat. Không có embeddings hoặc semantic cache; context phiên sản phẩm vẫn là cache RAM có giới hạn; reject/edit/delete có tác dụng ở các request sau.

Bộ so khớp giữ exact/normalized hash và lexical similarity >=0.9, giới hạn 100 ứng viên; giữ số tiền, phủ định và ràng buộc địa điểm/so sánh để tránh gộp nhầm. Đây không phải semantic search. Chưa có chống trùng lần gọi AI giữa các request đồng thời trước khi draft đầu tiên được lưu; unique DB vẫn chống tạo bản ghi trùng.

## 14. Kết quả build/test và chạy thử

- Backend build + TypeScript: PASS.
- Frontend build + TypeScript: PASS; còn cảnh báo Vite CJS deprecation có sẵn.
- `npm.cmd run test:chat`: 22 tests PASS, có đủ 12 tình huống yêu cầu.
- MySQL thật: PASS cho pending/approve/lookup/usage_count và truy vấn giá/tồn kho.
- Migration bảng tạm: PASS bảo toàn nội dung, chuyển status, ẩn small talk và chạy lại.
- AppModule thật với DB synchronize tắt riêng trong phép thử: `POST /api/chat` small talk PASS; 3 route Admin từng báo Cannot GET trả 401 khi không có JWT, không phải 404. ADMIN 200 / USER 403 được kiểm tra trong bộ HTTP test.
- Gemini thật: endpoint metadata xác nhận model tồn tại, nhưng generateContent trả 504 ngày 29/09/2026, cả JSON lẫn text thuần; phép thử tối đa 40 giây cũng timeout. Vì vậy chưa xác nhận được lượt sinh trả lời thật thành công ở lần chạy này. Giữ timeout 15 giây, không đổi model hay tăng retry để che lỗi provider. Tất cả Knowledge kiểm thử đã rollback.

### Cấu hình và chạy

Key chỉ đặt trong `backend/.env`:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
```

Không đưa key vào React hoặc biến VITE_*. `.env` đang bị gitignore; không sửa/commit key.

```powershell
cd backend
npm.cmd run build
npm.cmd run db:chatbot
npm.cmd run start:dev
```

Terminal khác:

```powershell
cd frontend
npm.cmd run dev
```

Dùng `start:dev`, không dùng `npm run start dev` khi cần watch/reload. Prefix toàn cục vẫn `api`; controller không thêm prefix lần hai. Nếu vẫn Cannot GET, kiểm tra tiến trình backend cũ và VITE_API_URL (mặc định `http://localhost:3000/api`).

### API và test

```json
POST /api/chat
{ "message": "Xin chào" }

{ "message": "...", "source": "small_talk", "intent": "greeting", "cached": false }
```

source: knowledge/gemini/product/small_talk/system. Chỉ knowledge có cached=true và knowledgeId. Khách không nhận confidence/risk/prompt/key. Widget hiện có vẫn chỉ hiển thị message.

Giữ các route Admin:

- GET `/api/admin/chatbot/stats`
- GET `/api/admin/chatbot/knowledge?status=pending_review&risk=HIGH&intent=shipping&page=1&limit=20`
- GET/POST/PATCH/DELETE knowledge như cũ; PATCH `:id/approve`, `:id/reject`.
- Query `status=pending` cũ được chuyển thành pending_review; response dùng tên status mới.

```powershell
cd backend
npm.cmd run test:chat
node.exe scripts/verify-chatbot.cjs --migration
# Một lượt Gemini thật; chỉ chạy lại khi dịch vụ sẵn sàng:
node.exe scripts/verify-chatbot.cjs --gemini
```

Mở widget: thử Xin chào/haha/emoji (không AI), câu ghế 2 triệu (DB), shipping/refund (draft-only nếu AI sẵn sàng). Đăng nhập Admin → Chatbot Knowledge → sửa/xác nhận draft rồi Approve; hỏi lại bằng “ship hàng” để kiểm tra source=knowledge trong Network.

Lỗi an toàn: 400 validation; 401/403 auth; 409 trùng/stale sản phẩm; 429 quota; 503 thiếu key/DB/JSON invalid/unavailable; 504 timeout; 500 lỗi khác. Không trả lỗi provider/DB thô về khách. Không log key hoặc nội dung chat.
