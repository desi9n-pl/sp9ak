import { describe, expect, it } from 'vitest';
import { PROVIDERS, classifyError, maskApiKey, normalizeConfig, validateConfig } from '../../../web/js/core/providers.js';

describe('normalizeConfig', () => {
    it('fills in the default model and trims the key', () => {
        expect(normalizeConfig({ provider: 'claude', model: ' ', apiKey: '  sk-ant-x ' }))
            .toEqual({ provider: 'claude', model: PROVIDERS.claude.defaultModel, apiKey: 'sk-ant-x' });
    });

    it('keeps a custom model', () => {
        expect(normalizeConfig({ provider: 'openai', model: ' gpt-4o ', apiKey: 'k' }).model).toBe('gpt-4o');
    });

    it('drops an unknown provider and its model', () => {
        expect(normalizeConfig({ provider: 'x', model: 'm', apiKey: 'k' })).toEqual({ provider: '', model: '', apiKey: 'k' });
    });

    it('does not mistake inherited object properties for providers', () => {
        expect(normalizeConfig({ provider: 'constructor' }).provider).toBe('');
    });

    it('copes with no argument', () => {
        expect(normalizeConfig()).toEqual({ provider: '', model: '', apiKey: '' });
    });
});

describe('validateConfig', () => {
    it.each([
        [{ provider: 'claude', apiKey: 'sk-ant-abc123' }],
        [{ provider: 'openai', apiKey: 'sk-proj-abc' }],
    ])('accepts %j', config => {
        expect(validateConfig(config)).toEqual({ ok: true, error: '' });
    });

    it.each([
        [{ provider: '', apiKey: 'sk-x' }, /dostawc/i],
        [{ provider: 'claude', apiKey: '   ' }, /klucz/i],
        [{ provider: 'openai', apiKey: 'sk- abc' }, /spacji/],
        [{ provider: 'claude', apiKey: 'sk-proj-abc' }, /sk-ant-/],
    ])('rejects %j', (config, message) => {
        const result = validateConfig(config);
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(message);
    });
});

describe('classifyError', () => {
    it.each([
        ['Claude API 401: invalid x-api-key', 'auth'],
        ['OpenAI API 401: Incorrect API key provided', 'auth'],
        ['Claude API 403: forbidden', 'auth'],
        ['OpenAI API 429: You exceeded your current quota', 'quota'],
        ['rate limit reached', 'quota'],
        ['Claude API 404: model: foo', 'model'],
        ['<urlopen error timed out>', 'network'],
        ['Failed to fetch', 'network'],
        ['timeout – brak odpowiedzi z API', 'network'],
        ['coś dziwnego', 'unknown'],
        ['', 'unknown'],
        [undefined, 'unknown'],
    ])('%s → %s', (message, kind) => {
        expect(classifyError(message).kind).toBe(kind);
    });

    it('truncates long unknown messages', () => {
        expect(classifyError('x'.repeat(200)).text).toHaveLength(80);
    });

    it('always returns text to show', () => {
        expect(classifyError('').text).toBe('Nieznany błąd');
    });
});

describe('maskApiKey', () => {
    it('hides the middle of a key', () => {
        expect(maskApiKey('sk-ant-secret-1234')).toBe('sk-…1234');
        expect(maskApiKey('sk-ant-secret-1234')).not.toContain('secret');
    });

    it.each([['abc', '…'], ['', ''], [undefined, '']])('%j → %j', (key, expected) => {
        expect(maskApiKey(key)).toBe(expected);
    });
});
