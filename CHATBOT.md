# Chatbot: nâng cấp Knowledge Base có kiểm soát

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
