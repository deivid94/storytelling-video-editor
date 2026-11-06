// @ts-check

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'playwright-report/**',
    'test-results/**',
    'src/**',
  ]),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Código simples e legível (Google eng-practices): funções pequenas e pouco aninhamento.
      complexity: ['warn', 10],
      'max-depth': ['warn', 3],
      'max-params': ['warn', 4],
      // Parâmetros com "_" são obrigatórios na assinatura mas não usados (ex.: middleware de erro do Express).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  prettier,
]);
