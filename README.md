# Hung Vuong Gia dụng

Sự kiện ưu đãi: xem [hướng dẫn quản trị, nâng cấp database và kiểm thử](PROMOTIONS.md).

Đánh giá sau mua: xem [điều kiện đánh giá, thống kê sao và nâng cấp database](REVIEWS.md).

> Website thương mại điện tử bán đồ gia dụng và thiết bị nhà bếp, xây dựng trong khuôn khổ **Đồ án Liên ngành**. Dự án có giao diện mua sắm cho khách hàng và khu vực quản trị để vận hành cửa hàng.

## Thành viên

| Họ và tên | Mã sinh viên |
| --- | --- |
| Nguyễn Quang Hưng | 23010103 |
| Vi Hùng Vương | 23016891 |

## Dự án làm về gì?

Hung Vuong Gia dụng mô phỏng quy trình mua sắm trực tuyến từ lúc khách tìm sản phẩm đến khi cửa hàng tiếp nhận và xử lý đơn. Người mua có thể duyệt danh mục, tìm kiếm, xem thông tin sản phẩm, lưu sản phẩm yêu thích, quản lý giỏ hàng, áp mã giảm giá và theo dõi đơn hàng. Quản trị viên có thể cập nhật sản phẩm, xử lý đơn, quản lý người dùng và xem báo cáo doanh thu.

Hệ thống được chia thành hai phần:

- **Frontend:** website tương tác dành cho khách hàng và quản trị viên.
- **Backend:** REST API xử lý xác thực, nghiệp vụ cửa hàng, thanh toán và dữ liệu.

## Chức năng chính

### Khách hàng

- Đăng ký, đăng nhập và cập nhật hồ sơ.
- Tìm kiếm sản phẩm, lọc theo danh mục và xem chi tiết.
- Quản lý giỏ hàng, danh sách yêu thích và địa chỉ nhận hàng.
- Đặt hàng, áp mã giảm giá và xem lịch sử/trạng thái đơn.
- Chọn thanh toán QR qua PayOS hoặc thanh toán khi nhận hàng.
- Gửi tin nhắn liên hệ và hỏi đáp với chatbot.
- Xem chính sách giao hàng, đổi trả, bảo hành, thanh toán và quyền riêng tư.

### Quản trị viên

- Quản lý sản phẩm, hình ảnh, giá bán, tồn kho và sản phẩm nổi bật.
- Theo dõi đơn hàng và cập nhật trạng thái xử lý.
- Quản lý tài khoản người dùng, mã giảm giá và tin nhắn liên hệ.
- Xem dashboard và doanh thu theo tháng.
- Quản lý nội dung kiến thức cho chatbot.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Giao diện | React, TypeScript, Vite, React Router |
| API | NestJS, TypeScript, REST |
| Cơ sở dữ liệu | MySQL, TypeORM |
| Xác thực | JWT, phân quyền USER/ADMIN |
| Tích hợp | PayOS cho QR, Gemini cho chatbot, Resend cho email |

## Cấu trúc thư mục

```text
.
├── backend/
│   └── src/
│       ├── admin/       # API quản trị và báo cáo
│       ├── auth/        # đăng ký, đăng nhập, JWT
│       ├── cart/        # giỏ hàng
│       ├── chat/        # chatbot và kiến thức
│       ├── database/    # cấu hình TypeORM và entities
│       ├── orders/      # đơn hàng
│       ├── payment/     # PayOS và webhook
│       └── products/    # sản phẩm
├── database/
│   └── schema.sql       # cấu trúc và dữ liệu mẫu MySQL
└── frontend/
    └── src/
        ├── api/          # gọi backend
        ├── components/   # thành phần giao diện dùng lại
        ├── context/      # trạng thái đăng nhập và giỏ hàng
        ├── layouts/      # bố cục khách hàng và admin
        ├── pages/        # các trang website
        └── styles/       # CSS
```

## Yêu cầu

- Node.js và npm.
- MySQL tương thích; cấu hình kết nối của dự án hiện bật SSL, phù hợp với dịch vụ MySQL có TLS (ví dụ Aiven).
- Các khóa dịch vụ bên ngoài nếu muốn dùng PayOS, Gemini hoặc gửi email.

## Cài đặt và chạy ở môi trường phát triển

### 1. Tạo cơ sở dữ liệu

Tạo database MySQL và nạp file `database/schema.sql` để tạo bảng cùng dữ liệu mẫu. Backend dùng TypeORM `synchronize` để đồng bộ entity khi khởi động; chỉ nên dùng thiết lập này trong môi trường phát triển.

### 2. Cấu hình backend

Tạo file `backend/.env` (các file `.env` không được đưa lên Git):

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=your-mysql-host
DB_PORT=3306
DB_USERNAME=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=giadung_shop

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d

# Cần cấu hình nếu sử dụng thanh toán PayOS
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_CANCEL_URL=http://localhost:5173/checkout/success
PAYOS_RETURN_URL=http://localhost:5173/checkout/success

# Không bắt buộc: chatbot AI và email OTP
GEMINI_API_KEY=
RESEND_API_KEY=
MAIL_FROM=onboarding@resend.dev
```

Đặt `PAYOS_RETURN_URL` trỏ tới trang nhận kết quả thanh toán của website. Để PayOS cập nhật đơn tự động, cấu hình URL webhook công khai của backend theo endpoint `/api/payment/payos/webhook` trong trang quản lý PayOS.

### 3. Cấu hình frontend

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Cài dependencies và chạy

Mở hai terminal riêng:

```bash
cd backend
npm install
npm run start:dev
```

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`; backend API tại `http://localhost:3000/api`.

## Build

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

## Dữ liệu mẫu

File `database/schema.sql` có dữ liệu admin và sản phẩm mẫu để trình diễn. Tài khoản admin mẫu là `admin` / `admin123`; chỉ dùng cho môi trường cục bộ, hãy đổi mật khẩu ngay nếu dùng database có thể truy cập từ bên ngoài.

Thanh toán thẻ hiện là giao diện mô phỏng, chưa kết nối cổng xử lý thẻ thực. Hồ sơ chỉ lưu thông tin hiển thị tối thiểu (loại/ngân hàng, tên, 4 số cuối, hạn dùng) và mã PIN website ở dạng băm; không lưu số thẻ đầy đủ hoặc CVV. PIN 6 số chỉ minh họa bước xác nhận của website, không phải PIN ngân hàng. Khi xác minh đúng, đơn được đánh dấu đã thanh toán mô phỏng và tự chuyển sang đã xác nhận, nhưng không có giao dịch hoặc thu tiền thật. Thanh toán QR cần thông tin PayOS hợp lệ và webhook có thể truy cập từ Internet để cập nhật trạng thái tự động. Chatbot AI và gửi email cần khóa dịch vụ tương ứng; một số chức năng có thể không hoạt động nếu thiếu cấu hình.

## Luồng xử lý tổng quan

```text
Trình duyệt React
      │ REST API / JWT
      ▼
NestJS controllers → services → TypeORM → MySQL
      │
      ├── PayOS webhook → cập nhật thanh toán và đơn hàng
      ├── Gemini API → trả lời chatbot (nếu đã cấu hình)
      └── Resend → gửi email (nếu đã cấu hình)
```
