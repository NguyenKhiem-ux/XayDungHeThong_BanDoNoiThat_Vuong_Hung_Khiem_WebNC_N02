/** @template {{ productId: number }} T @param {T[]} favorites */
export function favoriteIds(favorites) {
  return favorites.map(item => item.productId);
}

/** @template {{ productId: number }} T @param {T[]} favorites @param {T} favorite */
export function addFavorite(favorites, favorite) {
  return favorites.some(item => item.productId === favorite.productId) ? favorites : [favorite, ...favorites];
}

/** @template {{ productId: number }} T @param {T[]} favorites @param {number} productId */
export function removeFavorite(favorites, productId) {
  return favorites.filter(item => item.productId !== productId);
}
