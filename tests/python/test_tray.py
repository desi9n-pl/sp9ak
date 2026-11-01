import importlib
import json
import sys
import tempfile
import unittest
import urllib.error
from unittest import mock


def import_tray():
    """Imports desktop.tray against a stand-in for GTK, so the tests need no display or PyGObject."""
    gi = mock.MagicMock()
    repository = mock.MagicMock()
    with mock.patch.dict(sys.modules, {'gi': gi, 'gi.repository': repository}):
        sys.modules.pop('desktop.tray', None)
        return importlib.import_module('desktop.tray'), repository


class TrayTestCase(unittest.TestCase):
    def setUp(self):
        self.tray, self.repository = import_tray()
        self.addCleanup(sys.modules.pop, 'desktop.tray', None)
        # the real lock would clash with a tray running on this machine
        patcher = mock.patch.object(self.tray, 'acquire_single_instance', return_value=mock.Mock())
        patcher.start()
        self.addCleanup(patcher.stop)


class SendHotkeyTest(TrayTestCase):
    def test_posts_the_action_to_the_local_server(self):
        with mock.patch.object(self.tray.urllib.request, 'urlopen') as urlopen:
            self.tray.send_hotkey('stop')
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertTrue(request.full_url.endswith('/api/hotkey'))
        self.assertEqual(json.loads(request.data), {'action': 'stop'})

    def test_a_missing_server_is_not_an_error(self):
        with mock.patch.object(self.tray.urllib.request, 'urlopen', side_effect=urllib.error.URLError('down')):
            self.tray.send_hotkey('start')


class HotkeyCallbacksTest(TrayTestCase):
    def run_idle_callback(self):
        """Runs the function the hotkey thread handed to GLib.idle_add and returns its result."""
        glib = self.tray.GLib
        self.assertEqual(glib.idle_add.call_count, 1)
        return glib.idle_add.call_args.args[0]()

    def test_start_shows_the_window_then_asks_the_page_to_dictate(self):
        calls = mock.Mock()
        with mock.patch.object(self.tray.x11, 'bring_here', calls.bring), \
                mock.patch.object(self.tray, 'send_hotkey', calls.send):
            self.tray.on_start_hotkey()
            self.assertFalse(self.run_idle_callback())
        self.assertEqual([c[0] for c in calls.mock_calls], ['bring', 'send'])
        calls.send.assert_called_once_with('start')

    def test_stop_leaves_the_window_alone(self):
        with mock.patch.object(self.tray.x11, 'bring_here') as bring, \
                mock.patch.object(self.tray, 'send_hotkey') as send:
            self.tray.on_stop_hotkey()
            self.assertFalse(self.run_idle_callback())
        bring.assert_not_called()
        send.assert_called_once_with('stop')


class WindowPlacerTest(TrayTestCase):
    def test_places_the_window_once_it_exists_and_stops_polling(self):
        placer = self.tray.WindowPlacer()
        with mock.patch.object(self.tray.x11, 'find_window', return_value=42), \
                mock.patch.object(self.tray.x11, 'place_bottom_right') as place:
            self.assertFalse(placer())
        place.assert_called_once_with(42)

    def test_keeps_polling_until_the_attempts_run_out(self):
        placer = self.tray.WindowPlacer()
        with mock.patch.object(self.tray.x11, 'find_window', return_value=None), \
                mock.patch.object(self.tray.x11, 'retitle_loading_window'), \
                mock.patch.object(self.tray.x11, 'place_bottom_right') as place:
            results = [placer() for _ in range(self.tray.WINDOW_POLL_ATTEMPTS)]
        self.assertEqual(results.count(True), self.tray.WINDOW_POLL_ATTEMPTS - 1)
        self.assertFalse(results[-1])
        place.assert_not_called()

    def test_titles_the_window_while_it_is_still_loading(self):
        placer = self.tray.WindowPlacer()
        with mock.patch.object(self.tray.x11, 'find_window', return_value=None), \
                mock.patch.object(self.tray.x11, 'retitle_loading_window') as retitle, \
                mock.patch.object(self.tray.x11, 'place_bottom_right') as place:
            self.assertTrue(placer())
        retitle.assert_called_once_with()
        place.assert_not_called()


class QuitTest(TrayTestCase):
    def test_closes_the_window_and_leaves_the_main_loop(self):
        with mock.patch.object(self.tray.x11, 'close_window') as close:
            self.tray.quit_app()
        close.assert_called_once()
        self.tray.Gtk.main_quit.assert_called_once()


class SingleInstanceTest(unittest.TestCase):
    def setUp(self):
        self.tray, _ = import_tray()
        self.addCleanup(sys.modules.pop, 'desktop.tray', None)
        runtime = tempfile.TemporaryDirectory()
        self.addCleanup(runtime.cleanup)
        env = mock.patch.dict('os.environ', {'XDG_RUNTIME_DIR': runtime.name})
        env.start()
        self.addCleanup(env.stop)

    def test_a_second_tray_for_the_same_port_gets_no_lock(self):
        first = self.tray.acquire_single_instance(4001)
        self.addCleanup(first.close)
        self.assertIsNotNone(first)
        self.assertIsNone(self.tray.acquire_single_instance(4001))

    def test_other_ports_and_a_released_lock_are_free(self):
        first = self.tray.acquire_single_instance(4001)
        other = self.tray.acquire_single_instance(4002)
        self.addCleanup(other.close)
        self.assertIsNotNone(other)
        first.close()
        again = self.tray.acquire_single_instance(4001)
        self.addCleanup(again.close)
        self.assertIsNotNone(again)


class MainTest(TrayTestCase):
    def test_a_second_tray_exits_without_building_an_icon(self):
        with mock.patch.object(self.tray, 'acquire_single_instance', return_value=None):
            self.tray.main()
        self.tray.Gtk.StatusIcon.new_from_file.assert_not_called()
        self.tray.Gtk.main.assert_not_called()

    def test_wires_the_icon_hotkeys_and_main_loop(self):
        hotkey = mock.Mock()
        hotkey.start.return_value = None
        with mock.patch.object(self.tray, 'GlobalHotkey', return_value=hotkey) as global_hotkey:
            self.tray.main()
        specs = [c.args[0] for c in global_hotkey.call_args_list]
        self.assertEqual(specs, [self.tray.HOTKEY_START, self.tray.HOTKEY_STOP])
        self.assertEqual(hotkey.start.call_count, 2)
        self.tray.Gtk.main.assert_called_once()
        self.tray.GLib.timeout_add.assert_called_once()

    def test_a_taken_shortcut_only_prints_a_warning(self):
        hotkey = mock.Mock()
        hotkey.start.return_value = 'Skrót jest zajęty'
        with mock.patch.object(self.tray, 'GlobalHotkey', return_value=hotkey), \
                mock.patch('sys.stderr') as stderr:
            self.tray.main()
        self.assertTrue(stderr.write.called)
        self.tray.Gtk.main.assert_called_once()

    def test_menu_entries_show_and_quit(self):
        self.tray.build_menu()
        labels = [c.kwargs['label'] for c in self.tray.Gtk.MenuItem.call_args_list]
        self.assertEqual(labels, ['Pokaż sp9ak', 'Zamknij sp9ak'])


if __name__ == '__main__':
    unittest.main()
