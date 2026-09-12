import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'coverage/**', 'node_modules/**', '.stryker-tmp/**', 'reports/**',
      // Human-owned CommonJS config, consumed by dependency-cruiser, not by our build.
      '.dependency-cruiser.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ['error', { max: 8 }],
    },
  },
  {
    files: ['eslint.config.js', 'vitest.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Pipeline tooling: run by tsx, never bundled. Console output is its entire purpose.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
