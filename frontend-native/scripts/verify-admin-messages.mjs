import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { adminMessagePreview, adminMessagesPageCount, filterAdminMessages } from '../src/adminMessages.mjs';

const messages = [
  { id: 1, name: 'Nguyễn Văn An', email: 'an@example.com', phone: '0912345678', message: 'Cần tư vấn nồi cơm điện', isRead: false },
  { id: 2, name: 'Trần Mai', email: 'mai@example.com', phone: null, message: 'Xin thông tin bảo hành', isRead: true },
];
assert.deepEqual(filterAdminMessages(messages, 'nguyen van', ''), [messages[0]]);
assert.deepEqual(filterAdminMessages(messages, 'bao hanh', 'read'), [messages[1]]);
assert.deepEqual(filterAdminMessages(messages, '', 'unread'), [messages[0]]);
assert.equal(adminMessagesPageCount(17, 8), 3);
assert.equal(adminMessagesPageCount(0, 8), 1);
assert.equal(adminMessagePreview('  Nội dung\n dài  ', 20), 'Nội dung dài');
assert.equal(adminMessagePreview('123456789', 5), '12345…');

const screenPath = new URL('../src/screens/AdminMessagesScreen.tsx', import.meta.url);
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
    unexpectedTextNodes.push(`${location.line + 1}:${location.character + 1}`);
  }
  ts.forEachChild(node, inspectJsx);
}
inspectJsx(sourceFile);
assert.deepEqual(unexpectedTextNodes, []);
assert.doesNotMatch(screenSource, /\{(?:error|notice|actionError)\s*&&/);

console.log('Admin messages checks passed.');
