import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: ['dist/**', 'coverage/**', '.vitest/**', 'node_modules/**']
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node }
  },
  tseslint.configs.recommended,
  eslintConfigPrettier
])
