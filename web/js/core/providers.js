/** Configuration rules for the external AI providers (the calls themselves go through the server). */

export const PROVIDERS = {
    claude: { label: 'Claude', defaultModel: 'claude-haiku-4-5-20251001', keyPrefix: 'sk-ant-' },
    openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini', keyPrefix: 'sk-' },
};

/** Trims form input and fills in the provider's default model. */
export function normalizeConfig({ provider, model, apiKey } = {}) {
    const known = Object.hasOwn(PROVIDERS, provider);
    return {
        provider: known ? provider : '',
        model: known ? (model ?? '').trim() || PROVIDERS[provider].defaultModel : '',
        apiKey: (apiKey ?? '').trim(),
    };
}

/** Offline sanity check of a config. */
export function validateConfig(config) {
    const { provider, apiKey } = normalizeConfig(config);
    if (!provider) return { ok: false, error: 'Wybierz dostawcę' };
    if (!apiKey) return { ok: false, error: 'Podaj klucz API' };
    if (/\s/.test(apiKey)) return { ok: false, error: 'Klucz nie może zawierać spacji' };
    const { label, keyPrefix } = PROVIDERS[provider];
    if (!apiKey.startsWith(keyPrefix)) {
        return { ok: false, error: `Klucz ${label} powinien zaczynać się od „${keyPrefix}”` };
    }
    return { ok: true, error: '' };
}

const ERROR_KINDS = [
    ['auth', /\b(401|403)\b|invalid.*(key|token)|authentication|unauthorized|incorrect api key/i,
        'Klucz odrzucony (nieprawidłowy lub bez uprawnień)'],
    ['quota', /\b429\b|rate.?limit|quota/i, 'Przekroczony limit lub brak środków'],
    ['model', /\b404\b|model.*(not found|does not exist)/i, 'Nie znaleziono modelu – sprawdź nazwę'],
    ['network', /failed to fetch|networkerror|urlopen|timed out|timeout|connection/i, 'Brak połączenia z API'],
];

const UNKNOWN_ERROR_PREVIEW = 80;

/** Maps a proxy error message to a kind and a short Polish description. */
export function classifyError(message) {
    const text = String(message ?? '');
    for (const [kind, pattern, description] of ERROR_KINDS) {
        if (pattern.test(text)) return { kind, text: description };
    }
    return { kind: 'unknown', text: text.slice(0, UNKNOWN_ERROR_PREVIEW) || 'Nieznany błąd' };
}

/** `sk-ant-api03-…wxyz` → `sk-…wxyz`, safe to show in the UI. */
export function maskApiKey(key) {
    const k = (key ?? '').trim();
    if (k.length <= 8) return k ? '…' : '';
    return `${k.slice(0, 3)}…${k.slice(-4)}`;
}
