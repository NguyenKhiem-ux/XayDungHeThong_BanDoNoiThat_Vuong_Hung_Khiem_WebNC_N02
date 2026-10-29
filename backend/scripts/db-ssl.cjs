// Cấu hình SSL MySQL cho các setup/verify script; giữ đồng bộ với src/database/ssl.ts.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// DB_CA_CERT nhận nội dung PEM (có thể viết \n trên một dòng) hoặc đường dẫn file, tương đối với thư mục backend.
function mysqlSsl(caCert = process.env.DB_CA_CERT) {
  if (!caCert?.trim()) {
    console.warn('DB_CA_CERT chưa được đặt: kết nối MySQL không kiểm tra chứng chỉ (chỉ dùng cho dev local).');
    return { rejectUnauthorized: false };
  }
  const ca = caCert.includes('-----BEGIN') ? caCert.replace(/\\n/g, '\n') : readFileSync(resolve(__dirname, '..', caCert.trim()), 'utf8');
  return { ca, rejectUnauthorized: true };
}

module.exports = { mysqlSsl };
