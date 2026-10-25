import { createHash } from 'node:crypto';

export function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeQuestion(value: string) {
  return normalizeText(value)
    .replace(/\b(?:ship hang|shipping|ship|van chuyen)\b/g, 'giao hang')
    .replace(/\bcua hang\b/g, 'shop');
}

export function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function questionKey(value: string) {
  return hashText(normalizeQuestion(value));
}

export function questionWords(value: string) {
  const stop = new Set(['shop', 'toi', 'minh', 'ban', 'vui', 'long', 'giup', 'a', 'nhe', 'nha', 'voi']);
  return [...new Set(normalizeQuestion(value).split(' ').filter(word => word && !stop.has(word)))];
}

export function similarity(left: string, right: string) {
  const a = normalizeQuestion(left);
  const b = normalizeQuestion(right);
  if (a === b) return 1;
  // Never merge changed numbers, negation, location or price comparison words.
  const constraints = (text: string) => text.split(' ').filter(word => /\d/.test(word) ||
    ['khong', 'chua', 'duoi', 'tren', 'truoc', 'sau', 'mien', 'phi', 'o', 'tai', 'den'].includes(word)).sort().join(' ');
  if (constraints(a) !== constraints(b)) return 0;
  const aw = questionWords(a);
  const bw = questionWords(b);
  if (aw.length < 3 || bw.length < 3) return 0;
  const shared = aw.filter(word => bw.includes(word)).length;
  // ponytail: conservative lexical matching, replace this scorer with embeddings when measured recall warrants it.
  return shared / Math.max(aw.length, bw.length);
}
