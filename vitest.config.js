import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.test.js'],
        coverage: {
            provider: 'v8',
            include: ['web/js/**/*.js'],
            reporter: ['text-summary', 'text', 'html'],
        },
    },
});
