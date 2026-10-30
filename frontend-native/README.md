# Gia dụng Việt — Expo

Frontend React Native + Expo Web cho giai đoạn chuyển đổi Trang chủ. Backend, Database và website Vite hiện tại vẫn được giữ nguyên.

## Chạy ứng dụng

```powershell
npm install
Copy-Item .env.example .env
npm run web
```

Expo Web mặc định gọi `/api` qua proxy dev trong `metro.config.js`, trỏ đến Backend `http://localhost:3000`; cách này giữ nguyên cấu hình CORS của Backend. Có thể đổi đích proxy bằng `EXPO_API_PROXY_TARGET`. Các màn hình chưa chuyển đổi mở trên website Vite tại `EXPO_PUBLIC_WEB_URL`.

`EXPO_PUBLIC_API_URL` chấp nhận Backend origin hoặc URL kết thúc bằng `/api`; client chỉ thêm `/api` một lần. `EXPO_PUBLIC_API_ORIGIN` là origin không có `/api`, dùng cho ảnh/tệp tĩnh.

Android Emulator:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api
EXPO_PUBLIC_API_ORIGIN=http://10.0.2.2:3000
EXPO_PUBLIC_WEB_URL=http://10.0.2.2:5173
```

Điện thoại thật phải dùng IP LAN hoặc URL HTTPS truy cập được; không dùng `localhost` và không đoán/cố định IP trong source:

```env
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000/api
EXPO_PUBLIC_API_ORIGIN=http://<LAN-IP>:3000
EXPO_PUBLIC_WEB_URL=http://<LAN-IP>:5173
```

Chạy website Vite để điện thoại có thể truy cập bằng LAN:

```powershell
cd ..\frontend
npm run dev -- --host 0.0.0.0
```

Với bản web đã export, máy chủ triển khai cần reverse proxy `/api` đến Backend hoặc cung cấp `EXPO_PUBLIC_API_URL` HTTPS phù hợp lúc build. Production native cũng phải dùng Backend HTTPS.

## Kiểm tra

```powershell
npm run check
npm run export:web
```

Trang chủ dùng API thật cho sản phẩm nổi bật, Flash Sale, trạng thái tài khoản, giỏ hàng, yêu thích và chatbot. Login, Profile, Product Detail, Cart, Checkout, Orders, Admin và các trang nội dung vẫn được điều hướng sang frontend Vite trong giai đoạn này.
