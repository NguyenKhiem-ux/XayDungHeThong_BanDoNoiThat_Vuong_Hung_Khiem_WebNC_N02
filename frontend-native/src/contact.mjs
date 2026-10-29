/** @param {{ name: string; email: string; message: string }} form */
export function contactValidationError(form) {
  if (!form.name.trim()) return 'Vui lòng nhập họ và tên.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!form.message.trim()) return 'Vui lòng nhập nội dung cần hỗ trợ.';
  return '';
}
