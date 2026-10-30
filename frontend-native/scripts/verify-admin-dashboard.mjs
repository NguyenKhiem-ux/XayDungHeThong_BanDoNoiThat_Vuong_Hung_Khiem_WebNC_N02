import assert from 'node:assert/strict';
import { adminBarHeight, adminDayLabel, compactAdminMoney } from '../src/adminDashboard.mjs';

assert.equal(adminDayLabel('2026-10-30'), '30/10');
assert.equal(adminDayLabel('2026-10-30T00:00:00.000Z'), '30/10');
assert.equal(adminDayLabel('không rõ'), 'không rõ');
assert.equal(adminBarHeight(50, 100), 56);
assert.equal(adminBarHeight(0, 0), 4);
assert.equal(adminBarHeight(-10, 100), 4);
assert.equal(compactAdminMoney(950), '950');
assert.equal(compactAdminMoney(12_500), '13k');
assert.equal(compactAdminMoney(2_500_000), '2.5tr');

console.log('Admin dashboard checks passed.');
