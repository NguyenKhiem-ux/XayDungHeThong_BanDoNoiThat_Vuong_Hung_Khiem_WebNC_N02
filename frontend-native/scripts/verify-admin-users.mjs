import assert from 'node:assert/strict';
import { adminUserInitials, adminUserPageCount, filterAdminUsers } from '../src/adminUsers.mjs';

const users = [
  { id: 1, fullName: 'Đặng Văn An', username: 'an', email: 'an@example.com', phone: '0912345678', role: 'USER' },
  { id: 2, fullName: 'Quản trị viên', username: 'admin', email: 'admin@example.com', phone: null, role: 'ADMIN' },
];

assert.deepEqual(filterAdminUsers(users, { keyword: 'dang van', role: 'USER' }).map(user => user.id), [1]);
assert.deepEqual(filterAdminUsers(users, { keyword: 'admin@example', role: 'ADMIN' }).map(user => user.id), [2]);
assert.deepEqual(filterAdminUsers(users, { keyword: 'không có', role: '' }), []);
assert.equal(adminUserPageCount(31, 15), 3);
assert.equal(adminUserPageCount(0, 15), 1);
assert.equal(adminUserInitials('Nguyễn Văn An'), 'NA');
assert.equal(adminUserInitials('', 'admin', 'admin@example.com'), 'AD');

console.log('Admin user checks passed.');
