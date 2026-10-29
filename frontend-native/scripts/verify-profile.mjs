import assert from 'node:assert/strict';
import { avatarMimeType, avatarValidationError, isValidBirthDate, profileBackendField, profileValidationErrors } from '../src/profileValidation.mjs';

assert.equal(isValidBirthDate('2024-02-29', '2026-10-29'), true);
assert.equal(isValidBirthDate('2025-02-29', '2026-10-29'), false);
assert.equal(isValidBirthDate('2026-02-30', '2026-10-29'), false);
assert.equal(isValidBirthDate('2026-10-30', '2026-10-29'), false);
assert.equal(isValidBirthDate('29/02/2024', '2026-10-29'), false);
assert.deepEqual(profileValidationErrors({ fullName: 'Nguyễn Văn An', email: 'an@example.com', phone: '', birthDate: '2024-02-29' }, '2026-10-29'), {});
assert.equal(profileValidationErrors({ fullName: ' ', email: 'sai', phone: '1234567890123456', birthDate: '2025-02-29' }, '2026-10-29').fullName, 'Họ và tên không được để trống.');
assert.equal(profileBackendField('fullName must be shorter than 100 characters'), 'fullName');
assert.equal(avatarMimeType('avatar.PNG', ''), 'image/png');
assert.equal(avatarValidationError({ mimeType: 'application/pdf', fileSize: 100 }), 'Vui lòng chọn đúng định dạng tệp hình ảnh.');
assert.equal(avatarValidationError({ mimeType: 'image/jpeg', fileSize: 5 * 1024 * 1024 + 1 }), 'Ảnh đại diện không được vượt quá 5 MB.');

console.log('Profile/avatar validation checks passed.');
