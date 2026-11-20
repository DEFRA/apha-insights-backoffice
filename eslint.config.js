import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    files: ['src/**/*.js'],
    ignores: ['src/config/**', 'src/client/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read settings through #/config/config.js instead.'
        }
      ],
      'no-restricted-exports': [
        'error',
        { restrictDefaultExports: { direct: true, named: true } }
      ]
    }
  },
  {
    files: ['src/**/*.js'],
    ignores: ['src/constants/**', 'src/config/**', 'src/client/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^[A-Z][A-Z0-9_]*$/]',
          message:
            'Shared constants belong in src/constants/. Keep file-private constants unexported.'
        }
      ]
    }
  }
]
