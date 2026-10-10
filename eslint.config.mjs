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
  // React Compiler rules turned on by eslint-config-next 16.4. The flagged code
  // (Date.now() in render, resetting state in an effect, a ref synced during
  // render) works correctly, so keep them visible without blocking commits.
  {
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  // Must be last: turns off any ESLint formatting rules that would conflict
  // with Prettier, so Prettier is the single source of truth for formatting.
  eslintConfigPrettier,
]

export default eslintConfig
