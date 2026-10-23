import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from server import app
from server.ai_providers import ProviderError


class ServerTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.sessions_file = Path(cls.tmp.name) / 'sessions.json'
        cls.server = app.create_server(0, cls.sessions_file)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def request(self, method, path, body=None, raw=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port)
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        connection.request(method, path, body=data)
        response = connection.getresponse()
        payload = response.read()
        connection.close()
        return response, payload

    def json_request(self, method, path, body=None, raw=None):
        response, payload = self.request(method, path, body, raw)
        return response.status, (json.loads(payload) if payload else None)


class StaticFilesTest(ServerTestCase):
    def test_serves_the_frontend(self):
        response, body = self.request('GET', '/index.html')
        self.assertEqual(response.status, 200)
        self.assertIn(b'<title>sp9ak</title>', body)

    def test_never_caches(self):
        response, _ = self.request('GET', '/index.html')
        self.assertEqual(response.getheader('Cache-Control'), 'no-store')

    def test_does_not_expose_server_code(self):
        response, _ = self.request('GET', '/server/app.py')
        self.assertEqual(response.status, 404)


class SessionsTest(ServerTestCase):
    def test_empty_before_first_save(self):
        self.sessions_file.unlink(missing_ok=True)
        self.assertEqual(self.json_request('GET', '/api/sessions'), (200, []))

    def test_round_trip_keeps_polish_text_readable_on_disk(self):
        sessions = [{'id': '1', 'ts': '2026-01-01T00:00:00Z', 'text': 'zażółć gęślą jaźń'}]
        status, _ = self.json_request('POST', '/api/sessions', sessions)
        self.assertEqual(status, 204)
        self.assertEqual(self.json_request('GET', '/api/sessions')[1], sessions)
        self.assertIn('zażółć', self.sessions_file.read_text(encoding='utf-8'))

    def test_rejects_non_list(self):
        self.assertEqual(self.json_request('POST', '/api/sessions', {'not': 'a list'})[0], 400)

    def test_rejects_invalid_json(self):
        self.assertEqual(self.json_request('POST', '/api/sessions', raw=b'{oops')[0], 400)


class HotkeyTest(ServerTestCase):
    def snapshot(self):
        return self.json_request('GET', '/api/hotkey')[1]

    def test_every_post_advances_the_counter(self):
        before = self.snapshot()['seq']
        status, _ = self.json_request('POST', '/api/hotkey', raw=b'')
        self.assertEqual(status, 204)
        self.assertEqual(self.snapshot()['seq'], before + 1)

    def test_remembers_the_action(self):
        self.json_request('POST', '/api/hotkey', {'action': 'stop'})
        self.assertEqual(self.snapshot()['action'], 'stop')
        self.json_request('POST', '/api/hotkey', {'action': 'start'})
        self.assertEqual(self.snapshot()['action'], 'start')

    def test_unknown_action_means_start(self):
        self.json_request('POST', '/api/hotkey', {'action': 'stop'})
        self.json_request('POST', '/api/hotkey', {'action': 'rm -rf'})
        self.assertEqual(self.snapshot()['action'], 'start')


class WindowTest(ServerTestCase):
    def test_reports_the_window_state(self):
        with mock.patch.object(app.x11, 'window_state', return_value={'supported': True, 'alwaysOnTop': False}):
            self.assertEqual(self.json_request('GET', '/api/window'), (200, {'supported': True, 'alwaysOnTop': False}))

    def test_post_pins_the_window(self):
        pinned = {'supported': True, 'alwaysOnTop': True}
        with mock.patch.object(app.x11, 'set_always_on_top', return_value=pinned) as pin:
            status, payload = self.json_request('POST', '/api/window', {'alwaysOnTop': True})
        pin.assert_called_once_with(True)
        self.assertEqual((status, payload['alwaysOnTop']), (200, True))

    def test_rejects_a_non_boolean_flag(self):
        for body in ({'alwaysOnTop': 'yes'}, {}, []):
            self.assertEqual(self.json_request('POST', '/api/window', body)[0], 400)


class AiProxyTest(ServerTestCase):
    def test_returns_the_model_text(self):
        with mock.patch.object(app, 'complete', return_value='Cześć') as complete:
            result = self.json_request('POST', '/api/ai', {
                'provider': 'claude', 'apiKey': 'k', 'model': 'm', 'system': 's', 'prompt': 'p',
            })
        self.assertEqual(result, (200, {'text': 'Cześć'}))
        complete.assert_called_once_with('claude', 'k', 'm', 's', 'p')

    def test_provider_errors_become_a_500_with_message(self):
        with mock.patch.object(app, 'complete', side_effect=ProviderError('Brak klucza API')):
            status, body = self.json_request('POST', '/api/ai', {'provider': 'claude'})
        self.assertEqual((status, body), (500, {'error': 'Brak klucza API'}))

    def test_missing_fields_default_to_empty(self):
        with mock.patch.object(app, 'complete', return_value='x') as complete:
            self.json_request('POST', '/api/ai', {})
        complete.assert_called_once_with('', '', '', '', '')


class RoutingTest(ServerTestCase):
    def test_invalid_json_body(self):
        self.assertEqual(self.json_request('POST', '/api/ai', raw=b'{not json')[0], 400)

    def test_unknown_post_path(self):
        self.assertEqual(self.json_request('POST', '/nope', {})[0], 404)


class MainTest(unittest.TestCase):
    def test_port_comes_from_the_first_argument(self):
        server = mock.MagicMock()
        server.__enter__.return_value = server
        with mock.patch.object(app, 'create_server', return_value=server) as create:
            app.main(['9999'])
        create.assert_called_once_with(9999)
        server.serve_forever.assert_called_once()

    def test_default_port(self):
        server = mock.MagicMock()
        server.__enter__.return_value = server
        with mock.patch.object(app, 'create_server', return_value=server) as create:
            app.main([])
        create.assert_called_once_with(app.DEFAULT_PORT)


if __name__ == '__main__':
    unittest.main()
