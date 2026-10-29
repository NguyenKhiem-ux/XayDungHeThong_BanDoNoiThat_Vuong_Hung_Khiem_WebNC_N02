import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const oldHome = await readFile(new URL('../../frontend/src/pages/HomePage.tsx', import.meta.url), 'utf8');
const nativeContent = await readFile(new URL('../src/content.ts', import.meta.url), 'utf8');
const nativeProductCard = await readFile(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf8');
const urls = source => new Set(source.match(/https?:\/\/[^'"\s]+/g) ?? []);

for (const url of urls(oldHome)) {
  assert(urls(nativeContent).has(url), `URL ảnh từ HomePage.tsx chưa được giữ nguyên: ${url}`);
}
assert.match(nativeProductCard, /imageUrl\(product\.imageUrl\)/, 'ProductCard phải hiển thị nguyên product.imageUrl qua hàm ánh xạ URL.');
console.log('Đã xác minh toàn bộ URL ảnh Trang chủ cũ và product.imageUrl được giữ nguyên.');
