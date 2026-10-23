import json
import tempfile
import unittest
from pathlib import Path

from server.state import HotkeySignal, SessionStore


class SessionStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'sessions.json'

    def test_missing_file_means_no_sessions(self):
        self.assertEqual(SessionStore(self.path).load(), [])

    def test_saved_sessions_come_back(self):
        store = SessionStore(self.path)
        store.save([{'id': '1', 'text': 'zażółć'}])
        self.assertEqual(store.load(), [{'id': '1', 'text': 'zażółć'}])
        self.assertEqual(json.loads(self.path.read_text(encoding='utf-8'))[0]['text'], 'zażółć')


class HotkeySignalTest(unittest.TestCase):
    def test_starts_at_zero(self):
        self.assertEqual(HotkeySignal().snapshot(), {'seq': 0, 'action': 'start'})

    def test_fire_counts_and_remembers_the_action(self):
        signal = HotkeySignal()
        signal.fire('stop')
        signal.fire('stop')
        self.assertEqual(signal.snapshot(), {'seq': 2, 'action': 'stop'})

    def test_unknown_action_falls_back_to_start(self):
        signal = HotkeySignal()
        signal.fire('stop')
        signal.fire('explode')
        self.assertEqual(signal.snapshot()['action'], 'start')


if __name__ == '__main__':
    unittest.main()
