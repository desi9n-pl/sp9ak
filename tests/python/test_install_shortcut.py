import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts' / 'install-shortcut.sh'


class InstallShortcutTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.home = Path(self._tmp.name)
        self.env = {
            'PATH': os.environ['PATH'],
            'HOME': str(self.home),
            'XDG_DATA_HOME': str(self.home / 'share'),
            'XDG_CONFIG_HOME': str(self.home / 'config'),
        }
        self.entry = self.home / 'share' / 'applications' / 'sp9ak.desktop'

    def run_script(self, *args):
        return subprocess.run([str(SCRIPT), *args], env=self.env, capture_output=True, text=True)

    def test_installs_menu_entry_pointing_at_repo(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        text = self.entry.read_text(encoding='utf-8')
        self.assertIn(f'Exec="{ROOT}/sp9ak.sh"', text)
        self.assertIn(f'Icon={ROOT}/desktop/icon.svg', text)
        self.assertTrue((ROOT / 'desktop' / 'icon.svg').exists())

    def test_desktop_option_copies_entry_to_desktop(self):
        result = self.run_script('--desktop')
        self.assertEqual(result.returncode, 0, result.stderr)
        copies = list(self.home.glob('*/sp9ak.desktop')) + list(self.home.glob('sp9ak.desktop'))
        copies = [p for p in copies if p != self.entry]
        self.assertEqual(len(copies), 1, copies)
        self.assertTrue(os.access(copies[0], os.X_OK))

    def test_uninstall_removes_entries(self):
        self.run_script('--desktop')
        result = self.run_script('--uninstall')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.entry.exists())
        self.assertEqual(list(self.home.rglob('sp9ak.desktop')), [])

    def test_unknown_option_fails(self):
        self.assertEqual(self.run_script('--bogus').returncode, 2)


if __name__ == '__main__':
    unittest.main()
