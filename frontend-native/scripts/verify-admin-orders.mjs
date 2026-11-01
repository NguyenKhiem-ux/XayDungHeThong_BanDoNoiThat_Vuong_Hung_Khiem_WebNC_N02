import assert from 'node:assert/strict';
import { adminOrderPageCount, adminOrderTransitions, filterAdminOrders } from '../src/adminOrders.mjs';

assert.deepEqual(adminOrderTransitions('PENDING'), ['CONFIRMED', 'CANCELLED']);
assert.deepEqual(adminOrderTransitions('CONFIRMED'), ['DELIVERED', 'CANCELLED']);
assert.deepEqual(adminOrderTransitions('DELIVERED'), []);
assert.deepEqual(adminOrderTransitions('CANCELLED'), []);

const orders = [
  { id: 12, fullName: 'Đặng Văn An', email: 'an@example.com', phone: '0912345678', status: 'PENDING', paymentMethod: 'CASH', createdAt: '2026-10-30T02:00:00.000Z' },
  { id: 11, fullName: 'Trần Bình', email: 'binh@example.com', phone: '0987654321', status: 'DELIVERED', paymentMethod: 'PAYOS', createdAt: '2026-10-20T02:00:00.000Z' },
];
const now = new Date(2026, 9, 30, 12).getTime();

assert.deepEqual(filterAdminOrders(orders, { keyword: '#12', status: '', paymentMethod: '', period: '' }, now).map(order => order.id), [12]);
assert.deepEqual(filterAdminOrders(orders, { keyword: 'dang van', status: 'PENDING', paymentMethod: 'CASH', period: 'today' }, now).map(order => order.id), [12]);
assert.deepEqual(filterAdminOrders(orders, { keyword: '', status: '', paymentMethod: 'PAYOS', period: '7d' }, now), []);
assert.equal(adminOrderPageCount(25, 12), 3);
assert.equal(adminOrderPageCount(0, 12), 1);

console.log('Admin order checks passed.');
