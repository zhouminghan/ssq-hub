export default [
  {
    files: ['web/js/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        AbortController: 'readonly',
        console: 'readonly',
        CustomEvent: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        history: 'readonly',
        HTMLElement: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        Node: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        ResizeObserver: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart']
    },
  },
  {
    ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
];
