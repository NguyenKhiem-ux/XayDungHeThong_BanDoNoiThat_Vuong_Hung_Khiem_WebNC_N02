import assert from 'node:assert/strict';
import { addFavorite, favoriteIds, removeFavorite } from '../src/favorites.mjs';

const first = { id: 1, productId: 10 };
const second = { id: 2, productId: 20 };
assert.deepEqual(favoriteIds([first, second]), [10, 20]);
assert.deepEqual(addFavorite([first], second), [second, first]);
assert.deepEqual(addFavorite([first], first), [first]);
assert.deepEqual(removeFavorite([first, second], 10), [second]);
