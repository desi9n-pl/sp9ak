import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/', 'coverage/', 'chrome-profile/', 'dist/'] },
    js.configs.recommended,
    {
        languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
        rules: {
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'multi-line'],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    { files: ['web/**/*.js'], languageOptions: { globals: globals.browser } },
    { files: ['tests/unit/**/*.js'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    {
        files: ['tests/e2e/**/*.mjs', 'vitest.config.js', 'eslint.config.js'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
];
