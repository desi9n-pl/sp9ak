"""Stan współdzielony przez wątki serwera: historia sesji i licznik skrótu globalnego."""
import json
import threading
from pathlib import Path

HOTKEY_ACTIONS = ('start', 'stop')


class SessionStore:
    """Historia sesji trzymana w jednym pliku JSON."""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def load(self):
        with self._lock:
            try:
                return json.loads(self.path.read_text(encoding='utf-8'))
            except FileNotFoundError:
                return []

    def save(self, sessions):
        text = json.dumps(sessions, ensure_ascii=False, indent=2)
        with self._lock:
            self.path.write_text(text, encoding='utf-8')


class HotkeySignal:
    """Tray zwiększa licznik (POST), strona go odpytuje (GET) i reaguje na zmianę."""

    def __init__(self):
        self.seq = 0
        self.action = 'start'
        self._lock = threading.Lock()

    def fire(self, action):
        with self._lock:
            self.action = action if action in HOTKEY_ACTIONS else 'start'
            self.seq += 1

    def snapshot(self):
        with self._lock:
            return {'seq': self.seq, 'action': self.action}
