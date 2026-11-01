export function productPageCount(total, pageSize) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(pageSize) || 1)));
}

export function productPaginationItems(currentPage, pageCount) {
  const total = Math.max(1, Number(pageCount) || 1);
  const current = Math.min(total, Math.max(1, Number(currentPage) || 1));
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach(page => pages.add(page));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach(page => pages.add(page));
  const ordered = [...pages].filter(page => page >= 1 && page <= total).sort((a, b) => a - b);

  return ordered.flatMap((page, index) => {
    const previous = ordered[index - 1];
    return previous && page - previous > 1 ? [`ellipsis-${previous}`, page] : [page];
  });
}
