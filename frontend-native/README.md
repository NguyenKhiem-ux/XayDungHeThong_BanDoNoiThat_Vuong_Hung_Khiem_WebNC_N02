# Gia dụng Việt — Expo

Frontend React Native + Expo Web cho giai đoạn chuyển đổi Trang chủ. Backend, Database và website Vite hiện tại vẫn được giữ nguyên.

## Chạy ứng dụng

```powershell
npm install
Copy-Item .env.example .env
npm run web
```

Expo Web mặc định gọi `/api` qua proxy dev trong `metro.config.js`, trỏ đến Backend `http://localhost:3000`; cách này giữ nguyên cấu hình CORS của Backend. Các màn hình chưa chuyển đổi mở trên website Vite tại `http://localhost:5173`. Khi chạy trên điện thoại thật, đặt `EXPO_PUBLIC_API_URL` và `EXPO_PUBLIC_API_ORIGIN` trong `.env` thành IP LAN của Backend.

Với bản web đã export, máy chủ triển khai cần reverse proxy `/api` đến Backend hoặc cung cấp `EXPO_PUBLIC_API_URL` phù hợp lúc build.

## Kiểm tra

```powershell
npm run check
npm run export:web
```

Trang chủ dùng API thật cho sản phẩm nổi bật, Flash Sale, trạng thái tài khoản, giỏ hàng, yêu thích và chatbot. Login, Profile, Product Detail, Cart, Checkout, Orders, Admin và các trang nội dung vẫn được điều hướng sang frontend Vite trong giai đoạn này.
