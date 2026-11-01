function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

export function filterAdminMessages(messages, keyword, readFilter = '') {
  const query = normalize(keyword);
  return messages.filter((message) => {
    if (readFilter === 'read' && !message.isRead) return false;
    if (readFilter === 'unread' && message.isRead) return false;
    if (!query) return true;
    return [message.name, message.email, message.phone, message.message].some(value => normalize(value).includes(query));
  });
}

export function adminMessagesPageCount(total, pageSize) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function adminMessagePreview(value, maxLength = 110) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
