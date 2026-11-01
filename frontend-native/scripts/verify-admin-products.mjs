import assert from 'node:assert/strict';
import { ADMIN_PRODUCT_IMAGE_MAX_BYTES, adminProductImageError, adminProductImageMime, adminProductPageCount, adminProductValidationErrors } from '../src/adminProducts.mjs';

assert.deepEqual(adminProductValidationErrors({ name: 'Nồi cơm', price: '1250000', stock: '12' }), {});
assert.deepEqual(adminProductValidationErrors({ name: ' ', price: '-1', stock: '1.5' }), {
  name: 'Vui lòng nhập tên sản phẩm.',
  price: 'Giá phải là số từ 0 trở lên.',
  stock: 'Tồn kho phải là số nguyên từ 0 trở lên.',
});
assert.equal(adminProductImageMime('photo.JPG'), 'image/jpeg');
assert.equal(adminProductImageMime('photo.bin', 'image/webp'), 'image/webp');
assert.equal(adminProductImageError({ mimeType: 'image/png', fileSize: ADMIN_PRODUCT_IMAGE_MAX_BYTES }), '');
assert.equal(adminProductImageError({ mimeType: 'image/gif', fileSize: 100 }), 'Ảnh phải có định dạng JPG, PNG hoặc WEBP.');
assert.equal(adminProductImageError({ mimeType: 'image/jpeg', fileSize: ADMIN_PRODUCT_IMAGE_MAX_BYTES + 1 }), 'Ảnh không được vượt quá 10 MB.');
assert.equal(adminProductPageCount(25, 12), 3);
assert.equal(adminProductPageCount(0, 12), 1);

console.log('Admin product checks passed.');
