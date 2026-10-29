import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // VITE_ALLOWED_HOSTS: danh sách host phân cách bằng dấu phẩy (ví dụ domain ngrok); để trống chỉ cho localhost.
  const allowedHosts = (loadEnv(mode, '.', '').VITE_ALLOWED_HOSTS ?? '')
    .split(',').map(host => host.trim()).filter(Boolean);
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts,
    },
  };
});
