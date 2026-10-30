// file dựng cấu hình SSL cho kết nối MySQL từ biến môi trường DB_CA_CERT.
// Giữ đồng bộ với scripts/db-ssl.cjs (bản dùng cho các setup script chạy trước khi build).
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// DB_CA_CERT nhận nội dung PEM (có thể viết \n trên một dòng) hoặc đường dẫn file, tương đối với thư mục backend.
export function mysqlSsl(caCert: string | undefined, baseDir = process.cwd()) {
  if (!caCert?.trim()) {
    new Logger('Database').warn('DB_CA_CERT chưa được đặt: kết nối MySQL không kiểm tra chứng chỉ (chỉ dùng cho dev local).');
    return { rejectUnauthorized: false };
  }
  const ca = caCert.includes('-----BEGIN') ? caCert.replace(/\\n/g, '\n') : readFileSync(resolve(baseDir, caCert.trim()), 'utf8');
  return { ca, rejectUnauthorized: true };
}
