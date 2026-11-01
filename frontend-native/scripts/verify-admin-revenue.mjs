import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { normalizeRevenueRows, revenueBarPercent, revenueMonths, revenueShare, revenueTotals, revenueYears } from '../src/adminRevenue.mjs';

const rows = normalizeRevenueRows([
  { period: '2026-01', orders: '2', revenue: '1500000' },
  { period: '2026-03', orders: 1, revenue: 500000 },
  { period: '2026-13', orders: 9, revenue: 9 },
  { period: 'bad', orders: 1, revenue: 1 },
]);
assert.deepEqual(rows, [
  { period: '2026-01', orders: 2, revenue: 1500000 },
  { period: '2026-03', orders: 1, revenue: 500000 },
]);
assert.deepEqual(revenueYears(rows, 2027), [2027, 2026]);
const months = revenueMonths(rows, 2026);
assert.equal(months.length, 12);
assert.deepEqual(months[1], { month: 2, period: '2026-02', orders: 0, revenue: 0 });
assert.deepEqual(revenueTotals(months), { orders: 3, revenue: 2000000 });
assert.equal(revenueShare(500000, 2000000), 0.25);
assert.equal(revenueShare(10, 0), 0);
assert.equal(revenueBarPercent(500000, 2000000), '25%');
assert.equal(revenueBarPercent(0, 2000000), '2%');

const screenPath = new URL('../src/screens/AdminRevenueScreen.tsx', import.meta.url);
const screenSource = readFileSync(screenPath, 'utf8');
const sourceFile = ts.createSourceFile(screenPath.pathname, screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const unexpectedTextNodes = [];

function nearestJsxTag(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent)) return parent.openingElement.tagName.getText(sourceFile);
  }
  return '';
}

function inspectJsx(node) {
  if (ts.isJsxText(node) && node.getText(sourceFile).trim() && nearestJsxTag(node) !== 'Text') {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    unexpectedTextNodes.push(`${location.line + 1}:${location.character + 1} ${JSON.stringify(node.getText(sourceFile))}`);
  }
  ts.forEachChild(node, inspectJsx);
}

inspectJsx(sourceFile);
assert.deepEqual(unexpectedTextNodes, []);
assert.match(screenSource, /\{error\.length > 0 && rows\.length > 0 &&/);

console.log('Admin revenue checks passed.');
