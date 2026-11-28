import globals from 'globals';
export default [
  {
    files: ['scripts/quality*.mjs', 'scripts/baseline*.mjs', 'scripts/bundle-sync-host.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'valid-typeof': 'error',
      'no-self-assign': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
