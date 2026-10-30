import assert from 'node:assert/strict';
import { adminCouponPageCount, couponDateInput, couponPayload, couponValidationErrors, filterAdminCoupons } from '../src/adminCoupons.mjs';

const valid = { code: ' sale10 ', description: '', discountType: 'percentage', discountValue: '10', minOrderAmount: '0', maxDiscountAmount: '50000', usageLimit: '5', startDate: '2026-10-30', endDate: '2026-11-30', isActive: true, userId: '', freeShipping: false };
assert.deepEqual(couponValidationErrors(valid), {});
assert.equal(couponPayload(valid).code, 'SALE10');
assert.equal(couponPayload(valid).userId, null);
assert.equal(couponPayload(valid).usageLimit, 5);
assert.equal(couponDateInput('2026-10-30T00:00:00.000Z').length, 10);

const invalid = { ...valid, code: '', discountValue: '101', minOrderAmount: '-1', maxDiscountAmount: '0', usageLimit: '1.5', startDate: '2026-02-30', userId: '-2' };
assert.deepEqual(Object.keys(couponValidationErrors(invalid)).sort(), ['code', 'discountValue', 'maxDiscountAmount', 'minOrderAmount', 'startDate', 'usageLimit', 'userId'].sort());
assert.equal(couponValidationErrors({ ...valid, endDate: '2026-01-01' }).endDate, 'Ngày hết hạn không được trước ngày bắt đầu.');

const coupons = [{ code: 'SALE10', description: 'Giảm mùa hè', discountType: 'percentage', isActive: true }, { code: '50K', description: null, discountType: 'fixed', isActive: false }];
assert.deepEqual(filterAdminCoupons(coupons, { keyword: 'mua he', discountType: 'percentage', active: 'active' }).map(coupon => coupon.code), ['SALE10']);
assert.equal(adminCouponPageCount(25, 12), 3);

console.log('Admin coupon checks passed.');
