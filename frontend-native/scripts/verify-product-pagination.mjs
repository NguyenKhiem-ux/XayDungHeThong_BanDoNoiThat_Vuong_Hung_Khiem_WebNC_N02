import assert from 'node:assert/strict';
import { productPageCount, productPaginationItems } from '../src/productPagination.mjs';

assert.equal(productPageCount(135, 12), 12);
assert.equal(productPageCount(12, 12), 1);
assert.equal(productPageCount(0, 12), 1);
assert.deepEqual(productPaginationItems(1, 12), [1, 2, 3, 4, 5, 'ellipsis-5', 12]);
assert.deepEqual(productPaginationItems(6, 12), [1, 'ellipsis-1', 5, 6, 7, 'ellipsis-7', 12]);
assert.deepEqual(productPaginationItems(12, 12), [1, 'ellipsis-1', 8, 9, 10, 11, 12]);

console.log('Product pagination checks passed.');
