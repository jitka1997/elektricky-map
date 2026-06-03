import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // Import sorting / hygiene (Prettier doesn't do this, so no overlap)
  {
    plugins: {
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
    },
  },
  // Must be last: turns off any ESLint formatting rules that would conflict
  // with Prettier, so Prettier is the single source of truth for formatting.
  eslintConfigPrettier,
]

export default eslintConfig