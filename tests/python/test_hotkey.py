import os
import shutil
import subprocess
import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from desktop import hotkey  # noqa: E402


class ParseHotkeyTest(unittest.TestCase):
    def test_default(self):
        self.assertEqual(hotkey.parse_hotkey(hotkey.DEFAULT_HOTKEY), (['ControlMask'], 'F11'))

    def test_default_stop_differs_and_has_shift(self):
        self.assertEqual(hotkey.parse_hotkey(hotkey.DEFAULT_HOTKEY_STOP), (['ControlMask', 'ShiftMask'], 'F11'))
        self.assertNotEqual(hotkey.DEFAULT_HOTKEY, hotkey.DEFAULT_HOTKEY_STOP)

    def test_multiple_modifiers_case_insensitive(self):
        self.assertEqual(hotkey.parse_hotkey('Ctrl+ALT+F11'), (['ControlMask', 'Mod1Mask'], 'F11'))

    def test_duplicate_modifier_collapsed(self):
        self.assertEqual(hotkey.parse_hotkey('ctrl+control+d')[0], ['ControlMask'])

    def test_super(self):
        self.assertEqual(hotkey.parse_hotkey('super+space'), (['Mod4Mask'], 'space'))

    def test_rejects_bare_key(self):
        with self.assertRaises(ValueError):
            hotkey.parse_hotkey('F11')

    def test_rejects_unknown_modifier(self):
        with self.assertRaises(ValueError):
            hotkey.parse_hotkey('hyper+F11')

    def test_rejects_empty(self):
        with self.assertRaises(ValueError):
            hotkey.parse_hotkey('')


@unittest.skipUnless(os.environ.get('DISPLAY') and shutil.which('xdotool'), 'brak X11/xdotool')
class GrabIntegrationTest(unittest.TestCase):
    """Prawdziwy XGrabKey: xdotool wciska skrót, callback musi zostać wywołany."""

    def test_hotkey_fires_callback_also_with_numlock(self):
        try:
            import Xlib  # noqa: F401
        except ImportError:
            self.skipTest('brak python-xlib')
        hits = []
        hk = hotkey.GlobalHotkey('ctrl+shift+F9', lambda: hits.append(1))
        err = hk.start()
        if err:
            self.skipTest(err)
        time.sleep(0.2)
        subprocess.run(['xdotool', 'key', 'ctrl+shift+F9'], check=True)
        time.sleep(0.4)
        self.assertEqual(len(hits), 1)

    def test_start_and_stop_hotkeys_do_not_trigger_each_other(self):
        hits = {'start': 0, 'stop': 0}
        a = hotkey.GlobalHotkey('ctrl+shift+F8', lambda: hits.__setitem__('start', hits['start'] + 1))
        b = hotkey.GlobalHotkey('ctrl+shift+alt+F8', lambda: hits.__setitem__('stop', hits['stop'] + 1))
        for h in (a, b):
            err = h.start()
            if err:
                self.skipTest(err)
        time.sleep(0.2)
        subprocess.run(['xdotool', 'key', 'ctrl+shift+F8'], check=True)
        time.sleep(0.3)
        subprocess.run(['xdotool', 'key', 'ctrl+shift+alt+F8'], check=True)
        time.sleep(0.3)
        self.assertEqual(hits, {'start': 1, 'stop': 1})

    def test_bad_key_reports_error(self):
        err = hotkey.GlobalHotkey('ctrl+nieistniejacyklawisz', lambda: None).start()
        self.assertIn('Nieznany klawisz', err or '')

    def test_bad_spec_reports_error(self):
        self.assertIn('modyfikator', hotkey.GlobalHotkey('F11', lambda: None).start())


if __name__ == '__main__':
    unittest.main()
