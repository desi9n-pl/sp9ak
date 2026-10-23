"""Klienci API zewnętrznych modeli (Claude, OpenAI) – serwer robi za proxy,
bo przeglądarka nie może wołać tych API bezpośrednio (CORS)."""
import json
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

REQUEST_TIMEOUT_S = 30
MAX_TOKENS = 2048
ERROR_BODY_PREVIEW = 300


class ProviderError(Exception):
    """Błąd po stronie dostawcy lub sieci; komunikat trafia do użytkownika."""


@dataclass(frozen=True)
class Provider:
    label: str
    url: str
    default_model: str
    build_headers: Callable[[str], dict]
    build_payload: Callable[[str, str, str], dict]
    extract_text: Callable[[dict], str]


def _claude_payload(model, system, prompt):
    payload = {
        'model': model,
        'max_tokens': MAX_TOKENS,
        'messages': [{'role': 'user', 'content': prompt}],
    }
    if system:
        payload['system'] = system
    return payload


def _openai_payload(model, system, prompt):
    messages = [{'role': 'system', 'content': system}] if system else []
    messages.append({'role': 'user', 'content': prompt})
    return {'model': model, 'messages': messages, 'max_tokens': MAX_TOKENS}


PROVIDERS = {
    'claude': Provider(
        label='Claude',
        url='https://api.anthropic.com/v1/messages',
        default_model='claude-haiku-4-5-20251001',
        build_headers=lambda key: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        build_payload=_claude_payload,
        extract_text=lambda data: data['content'][0]['text'],
    ),
    'openai': Provider(
        label='OpenAI',
        url='https://api.openai.com/v1/chat/completions',
        default_model='gpt-4o-mini',
        build_headers=lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        build_payload=_openai_payload,
        extract_text=lambda data: data['choices'][0]['message']['content'],
    ),
}


def _error_message(http_error):
    raw = http_error.read().decode('utf-8', errors='replace')
    try:
        return json.loads(raw).get('error', {}).get('message', raw)
    except (ValueError, AttributeError):
        return raw[:ERROR_BODY_PREVIEW]


def complete(provider_name, api_key, model, system, prompt):
    """Wysyła prompt do wybranego dostawcy i zwraca tekst odpowiedzi."""
    if not api_key:
        raise ProviderError('Brak klucza API')
    provider = PROVIDERS.get(provider_name)
    if provider is None:
        raise ProviderError(f'Nieznany dostawca: {provider_name}')

    payload = provider.build_payload(model or provider.default_model, system, prompt)
    request = urllib.request.Request(
        provider.url,
        data=json.dumps(payload).encode(),
        headers=provider.build_headers(api_key),
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
            return provider.extract_text(json.loads(response.read()))
    except urllib.error.HTTPError as e:
        raise ProviderError(f'{provider.label} API {e.code}: {_error_message(e)}') from e
    except (urllib.error.URLError, OSError) as e:
        reason = getattr(e, 'reason', e)
        raise ProviderError(f'Brak połączenia z API {provider.label} (urlopen: {reason})') from e
    except (KeyError, IndexError, ValueError) as e:
        raise ProviderError(f'Nieoczekiwana odpowiedź API {provider.label}') from e
