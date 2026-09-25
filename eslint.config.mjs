import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.pnpm-store/**',
      '**/coverage/**',
      '**/js/src/generated/**', // Ignore generated types
    ],
  },

  // Base JavaScript configuration
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      semi: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Disable no-undef for TypeScript files (TypeScript handles this)
      'no-undef': 'off',
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Vitest only rejects .only under CI for files it loads, and CI never loads
      // *.integration.test.ts, so a committed .only there silently skips the rest.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="only"]',
          message: 'Remove .only before committing: it skips every other test in the file.',
        },
      ],
    },
  },

  // Script files
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
];
