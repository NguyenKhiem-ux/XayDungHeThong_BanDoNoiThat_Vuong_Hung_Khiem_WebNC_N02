// Cấu hình ESLint (flat config) cho backend NestJS.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'uploads/', 'scripts/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Code hiện có dùng any ở các điểm nối với thư viện; giữ ở mức cảnh báo để sửa dần.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
