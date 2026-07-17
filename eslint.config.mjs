// Root ESLint config — covers packages/* and scripts/, which have no
// app-specific config of their own. apps/backend and apps/admin each
// own their own eslint.config.mjs (different frameworks, different
// plugin sets) — this is not layered underneath them.
//
// Note: ESLint 9+ dropped support for the classic .eslintrc format in
// favor of flat config, so this project uses eslint.config.mjs
// everywhere rather than .eslintrc — a deliberate, version-driven
// substitution, not an oversight.
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'apps/**'],
  },
  {
    files: ['packages/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
    },
  },
];
