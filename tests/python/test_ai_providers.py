import json
import unittest
import urllib.error
from unittest import mock

from server import ai_providers
from server.ai_providers import ProviderError, complete

from .helpers import FakeResponse, http_error


def patch_urlopen(side_effect):
    return mock.patch.object(ai_providers.urllib.request, 'urlopen', side_effect=side_effect)


class CompleteTest(unittest.TestCase):
    def test_claude_request_and_response(self):
        seen = {}

        def fake(request, timeout=None):
            seen.update(url=request.full_url, headers=dict(request.header_items()),
                        body=json.loads(request.data), timeout=timeout)
            return FakeResponse({'content': [{'text': 'OK'}]})

        with patch_urlopen(fake):
            text = complete('claude', 'sk-ant-k', 'my-model', 'be brief', 'hi')

        self.assertEqual(text, 'OK')
        self.assertIn('anthropic.com', seen['url'])
        self.assertEqual(seen['headers']['X-api-key'], 'sk-ant-k')
        self.assertEqual(seen['body']['model'], 'my-model')
        self.assertEqual(seen['body']['system'], 'be brief')
        self.assertEqual(seen['body']['messages'], [{'role': 'user', 'content': 'hi'}])
        self.assertEqual(seen['timeout'], ai_providers.REQUEST_TIMEOUT_S)

    def test_claude_omits_empty_system_prompt(self):
        seen = {}

        def fake(request, timeout=None):
            seen.update(json.loads(request.data))
            return FakeResponse({'content': [{'text': 'x'}]})

        with patch_urlopen(fake):
            complete('claude', 'k', '', '', 'hi')
        self.assertNotIn('system', seen)
        self.assertEqual(seen['model'], ai_providers.PROVIDERS['claude'].default_model)

    def test_openai_request_and_response(self):
        seen = {}

        def fake(request, timeout=None):
            seen.update(url=request.full_url, headers=dict(request.header_items()), body=json.loads(request.data))
            return FakeResponse({'choices': [{'message': {'content': 'Tak'}}]})

        with patch_urlopen(fake):
            text = complete('openai', 'sk-k', '', 'sys', 'hi')

        self.assertEqual(text, 'Tak')
        self.assertIn('openai.com', seen['url'])
        self.assertEqual(seen['headers']['Authorization'], 'Bearer sk-k')
        self.assertEqual(seen['body']['model'], 'gpt-4o-mini')
        self.assertEqual([m['role'] for m in seen['body']['messages']], ['system', 'user'])

    def test_openai_without_system_sends_only_user_message(self):
        seen = {}

        def fake(request, timeout=None):
            seen.update(json.loads(request.data))
            return FakeResponse({'choices': [{'message': {'content': 'x'}}]})

        with patch_urlopen(fake):
            complete('openai', 'k', 'm', '', 'hi')
        self.assertEqual([m['role'] for m in seen['messages']], ['user'])

    def test_missing_key(self):
        with self.assertRaisesRegex(ProviderError, 'klucza'):
            complete('claude', '', '', '', 'hi')

    def test_unknown_provider(self):
        with self.assertRaisesRegex(ProviderError, 'Nieznany dostawca: foo'):
            complete('foo', 'k', '', '', 'hi')

    def test_upstream_error_message_is_forwarded(self):
        rejected = patch_urlopen(http_error(401, {'error': {'message': 'invalid x-api-key'}}))
        with rejected, self.assertRaisesRegex(ProviderError, r'Claude API 401: invalid x-api-key'):
            complete('claude', 'bad', '', '', 'hi')

    def test_upstream_error_without_json_body_is_truncated(self):
        with patch_urlopen(http_error(502, b'<html>' + b'x' * 1000)), self.assertRaises(ProviderError) as caught:
            complete('openai', 'k', '', '', 'hi')
        message = str(caught.exception)
        self.assertIn('OpenAI API 502', message)
        self.assertLess(len(message), 400)

    def test_upstream_error_with_unexpected_json_shape(self):
        with patch_urlopen(http_error(500, [1, 2])), self.assertRaisesRegex(ProviderError, 'API 500'):
            complete('claude', 'k', '', '', 'hi')

    def test_network_failures_become_readable_errors(self):
        for failure in (urllib.error.URLError('no route'), TimeoutError('timed out'), ConnectionResetError()):
            with (self.subTest(failure=failure), patch_urlopen(failure),
                  self.assertRaisesRegex(ProviderError, 'Brak połączenia z API Claude')):
                complete('claude', 'k', '', '', 'hi')

    def test_unexpected_response_shape(self):
        unexpected = patch_urlopen(lambda request, timeout=None: FakeResponse({'unexpected': True}))
        with unexpected, self.assertRaisesRegex(ProviderError, 'Nieoczekiwana odpowiedź'):
            complete('claude', 'k', '', '', 'hi')


if __name__ == '__main__':
    unittest.main()
