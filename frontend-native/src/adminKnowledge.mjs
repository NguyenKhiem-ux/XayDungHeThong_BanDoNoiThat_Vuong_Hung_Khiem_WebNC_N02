export function knowledgeValidationError(form) {
  const question = String(form?.question ?? '').trim();
  const answer = String(form?.answer ?? '').trim();
  const keywords = String(form?.keywords ?? '').trim();
  if (!question) return 'Vui lòng nhập câu hỏi.';
  if (question.length > 1000) return 'Câu hỏi không được dài quá 1.000 ký tự.';
  if (!answer) return 'Vui lòng nhập câu trả lời.';
  if (answer.length > 8000) return 'Câu trả lời không được dài quá 8.000 ký tự.';
  if (keywords.length > 1000) return 'Từ khóa không được dài quá 1.000 ký tự.';
  return '';
}

export function knowledgePayload(form) {
  return {
    question: String(form.question).trim(),
    answer: String(form.answer).trim(),
    keywords: String(form.keywords ?? '').trim(),
  };
}

export function knowledgePageCount(total, limit = 20) {
  return Math.max(1, Math.ceil(Math.max(0, total) / limit));
}

export function knowledgePreview(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
