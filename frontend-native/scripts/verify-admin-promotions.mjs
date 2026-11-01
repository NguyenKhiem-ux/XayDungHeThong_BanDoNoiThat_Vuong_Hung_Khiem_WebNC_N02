import assert from 'node:assert/strict';
import { adminPromotionPageCount, filterAdminPromotions, promotionIsoTime, promotionLocalTime, promotionPayload, promotionValidationErrors } from '../src/adminPromotions.mjs';

const form = { title: 'Flash Sale', description: 'Ưu đãi', bannerDiscountPercent: '20', startsAt: '2026-10-30T09:00', endsAt: '2026-10-31T09:00' };
const items = [{ productId: 1, discountPercent: 20 }];
const now = Date.parse('2026-10-30T00:00:00.000Z');
assert.deepEqual(promotionValidationErrors(form, items, 'published', now), {});
assert.equal(promotionIsoTime(form.startsAt), '2026-10-30T02:00:00.000Z');
assert.equal(promotionLocalTime('2026-10-30T02:00:00.000Z'), form.startsAt);
assert.equal(promotionPayload(form, items, 'draft').status, 'draft');
assert.equal(promotionValidationErrors({ ...form, title: '', startsAt: '2026-02-30T09:00' }, [], 'published', now).items, 'Sự kiện công bố phải có ít nhất một sản phẩm.');
assert.equal(promotionValidationErrors({ ...form, bannerDiscountPercent: '30' }, items, 'published', now).bannerDiscountPercent, 'Mức giảm banner không được vượt mức giảm lớn nhất của sản phẩm.');

const events = [{ title: 'Đại tiệc hè', description: '', phase: 'active' }, { title: 'Cuối tuần', description: '', phase: 'draft' }];
assert.deepEqual(filterAdminPromotions(events, { keyword: 'dai tiec', phase: 'active' }).map(event => event.title), ['Đại tiệc hè']);
assert.equal(adminPromotionPageCount(17, 8), 3);

console.log('Admin promotion checks passed.');
