import { defineConfig, globalIgnores } from 'eslint/config'

import { app } from '../../.devtools/vite/eslint.js'

// coss ui's components are copied in by the shadcn CLI and keep their upstream code.
export default defineConfig([
  app,
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='size'][value.value=/^icon/]",
          message: 'Use IconButton, which gives an icon-only button its label and tooltip.'
        }
      ]
    }
  },
  globalIgnores(['src/components/ui'])
])
