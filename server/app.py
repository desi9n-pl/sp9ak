"""Serwer HTTP sp9ak: statyczny frontend plus małe API JSON."""
import json
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from desktop import x11

from .ai_providers import ProviderError, complete
from .state import HotkeySignal, SessionStore

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / 'web'
DEFAULT_PORT = 17823


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, store, hotkey, window, **kwargs):
        self.store = store
        self.hotkey = hotkey
        self.window = window
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    # ── odpowiedzi ───────────────────────────────────────────────

    def send_response(self, code, message=None):
        super().send_response(code, message)
        self.send_header('Cache-Control', 'no-store')

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status, message):
        self._send_json({'error': message}, status=status)

    def _send_empty(self, status=204):
        self.send_response(status)
        self.end_headers()

    def _read_json(self):
        """Zwraca ciało żądania jako JSON albo None, gdy jest niepoprawne."""
        length = int(self.headers.get('Content-Length') or 0)
        try:
            return json.loads(self.rfile.read(length) or b'{}')
        except ValueError:
            return None

    # ── routing ──────────────────────────────────────────────────

    def do_GET(self):
        if self.path == '/api/hotkey':
            self._send_json(self.hotkey.snapshot())
        elif self.path == '/api/sessions':
            self._send_json(self.store.load())
        elif self.path == '/api/window':
            self._send_json(self.window.window_state())
        else:
            super().do_GET()

    def do_POST(self):
        routes = {
            '/api/hotkey': self._post_hotkey,
            '/api/sessions': self._post_sessions,
            '/api/ai': self._post_ai,
            '/api/window': self._post_window,
        }
        handler = routes.get(self.path)
        if handler is None:
            self._send_error_json(404, 'Nie ma takiego adresu')
            return
        body = self._read_json()
        if body is None:
            self._send_error_json(400, 'Niepoprawny JSON')
            return
        handler(body)

    def _post_hotkey(self, body):
        self.hotkey.fire(body.get('action', 'start'))
        self._send_empty()

    def _post_sessions(self, body):
        if not isinstance(body, list):
            self._send_error_json(400, 'Oczekiwano listy sesji')
            return
        self.store.save(body)
        self._send_empty()

    def _post_window(self, body):
        if not isinstance(body, dict) or not isinstance(body.get('alwaysOnTop'), bool):
            self._send_error_json(400, 'Oczekiwano pola alwaysOnTop (true/false)')
            return
        self._send_json(self.window.set_always_on_top(body['alwaysOnTop']))

    def _post_ai(self, body):
        try:
            text = complete(
                body.get('provider', ''), body.get('apiKey', ''),
                body.get('model', ''), body.get('system', ''), body.get('prompt', ''),
            )
        except ProviderError as e:
            self._send_json({'error': str(e)}, status=500)
        else:
            self._send_json({'text': text})

    def log_message(self, fmt, *args):
        """Ciche logi – serwer działa w tle launchera."""


def create_server(port, sessions_path=None, window=x11):
    sessions_path = sessions_path or os.environ.get('SP9AK_SESSIONS') or ROOT / 'sessions.json'
    handler = partial(Handler, store=SessionStore(sessions_path), hotkey=HotkeySignal(), window=window)
    return ThreadingHTTPServer(('127.0.0.1', port), handler)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    port = int(argv[0]) if argv else DEFAULT_PORT
    with create_server(port) as server:
        server.serve_forever()
