import assert from 'node:assert/strict';
import { contactValidationError } from '../src/contact.mjs';

assert.equal(contactValidationError({ name: '', email: 'an@example.com', message: 'Tư vấn' }), 'Vui lòng nhập họ và tên.');
assert.equal(contactValidationError({ name: 'An', email: 'khong-hop-le', message: 'Tư vấn' }), 'Vui lòng nhập địa chỉ email hợp lệ.');
assert.equal(contactValidationError({ name: 'An', email: 'an@example.com', message: '' }), 'Vui lòng nhập nội dung cần hỗ trợ.');
assert.equal(contactValidationError({ name: 'An', email: 'an@example.com', message: 'Tư vấn' }), '');
