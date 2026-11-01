import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { knowledgePageCount, knowledgePayload, knowledgePreview, knowledgeValidationError } from '../src/adminKnowledge.mjs';

const valid = { question: '  Chính sách bảo hành? ', answer: '  Bảo hành theo nhà sản xuất. ', keywords: ' bảo hành ' };
assert.equal(knowledgeValidationError(valid), '');
assert.deepEqual(knowledgePayload(valid), { question: 'Chính sách bảo hành?', answer: 'Bảo hành theo nhà sản xuất.', keywords: 'bảo hành' });
assert.equal(knowledgeValidationError({ ...valid, question: ' ' }), 'Vui lòng nhập câu hỏi.');
assert.equal(knowledgeValidationError({ ...valid, answer: ' ' }), 'Vui lòng nhập câu trả lời.');
assert.equal(knowledgeValidationError({ ...valid, question: 'x'.repeat(1001) }), 'Câu hỏi không được dài quá 1.000 ký tự.');
assert.equal(knowledgeValidationError({ ...valid, answer: 'x'.repeat(8001) }), 'Câu trả lời không được dài quá 8.000 ký tự.');
assert.equal(knowledgeValidationError({ ...valid, keywords: 'x'.repeat(1001) }), 'Từ khóa không được dài quá 1.000 ký tự.');
assert.equal(knowledgePageCount(41), 3);
assert.equal(knowledgePreview(' Câu trả lời\n dài ', 20), 'Câu trả lời dài');

const screenPath = new URL('../src/screens/AdminChatbotKnowledgeScreen.tsx', import.meta.url);
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
assert.doesNotMatch(screenSource, /\{(?:error|notice|formError)\s*&&/);

console.log('Admin chatbot knowledge checks passed.');
