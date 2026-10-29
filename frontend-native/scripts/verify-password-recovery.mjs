import assert from 'node:assert/strict';
import { isValidEmail, newPasswordError, normalizeOtp, secondsUntil } from '../src/passwordRecovery.mjs';

assert.equal(isValidEmail('an@example.com'), true);
assert.equal(isValidEmail('invalid-email'), false);
assert.equal(normalizeOtp('12a 34567'), '123456');
assert.equal(secondsUntil('2026-01-01T00:05:00.000Z', Date.parse('2026-01-01T00:00:00.000Z')), 300);
assert.equal(newPasswordError('12345', '12345'), 'Mật khẩu mới phải có ít nhất 6 ký tự.');
assert.equal(newPasswordError('123456', '654321'), 'Mật khẩu nhập lại không khớp.');
assert.equal(newPasswordError('123456', '123456'), '');
