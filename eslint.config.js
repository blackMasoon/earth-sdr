import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off', // TypeScript handles this
      'no-undef': 'off', // TypeScript handles this
    },
  },
];
