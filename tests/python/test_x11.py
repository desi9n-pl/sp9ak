import subprocess
import unittest
from unittest import mock

from desktop import x11

WMCTRL_LIST = (
    '0x01c00003  0 10 20 540 640 other.localhost host Other window\n'
    '0x03a00007  0 100 200 540 640 sp9ak.localhost host sp9ak\n'
)
XRANDR = (
    'Screen 0: minimum 8 x 8, current 3840 x 1080\n'
    'HDMI-1 connected 1920x1080+1920+0 (normal left inverted right x axis y axis) 527mm x 296mm\n'
    'DP-1 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 527mm x 296mm\n'
    'VGA-1 disconnected (normal left inverted right x axis y axis)\n'
)


def fake_run(outputs):
    """A replacement for x11.run that answers by the tool name (first word)."""
    def run(*command):
        return outputs.get(command[0], '')
    return run


class RunTest(unittest.TestCase):
    def test_returns_stdout(self):
        completed = mock.Mock(stdout='hello')
        with mock.patch.object(x11.subprocess, 'run', return_value=completed):
            self.assertEqual(x11.run('echo', 'hello'), 'hello')

    def test_missing_tool_gives_empty_output(self):
        with mock.patch.object(x11.subprocess, 'run', side_effect=FileNotFoundError):
            self.assertEqual(x11.run('nope'), '')

    def test_timeout_gives_empty_output(self):
        with mock.patch.object(x11.subprocess, 'run', side_effect=subprocess.TimeoutExpired('x', 1)):
            self.assertEqual(x11.run('slow'), '')


class FindWindowTest(unittest.TestCase):
    def test_finds_the_app_window_by_title_and_host(self):
        with mock.patch.object(x11, 'run', fake_run({'wmctrl': WMCTRL_LIST})):
            self.assertEqual(x11.find_window(), 0x03A00007)

    def test_none_while_chrome_has_not_created_it(self):
        with mock.patch.object(x11, 'run', fake_run({'wmctrl': '0x01 0 0 0 1 1 other.localhost h Other\n'})):
            self.assertIsNone(x11.find_window())

    def test_ignores_malformed_lines(self):
        with mock.patch.object(x11, 'run', fake_run({'wmctrl': 'garbage\n'})):
            self.assertIsNone(x11.find_window())


class RetitleLoadingWindowTest(unittest.TestCase):
    def run_with(self, listing):
        calls = []

        def run(*command):
            calls.append(command)
            return listing if command[0] == 'wmctrl' else ''
        with mock.patch.object(x11, 'run', run):
            return x11.retitle_loading_window(), calls

    def test_renames_the_window_that_still_shows_the_address(self):
        found, calls = self.run_with('0x03a00007  0 100 200 540 640 localhost__index.html.Google-chrome-beta host localhost:17823/index.html\n')
        self.assertTrue(found)
        self.assertIn(('xdotool', 'set_window', '--name', 'sp9ak', str(0x03A00007)), calls)

    def test_leaves_a_window_that_already_has_the_final_title(self):
        found, calls = self.run_with(WMCTRL_LIST)
        self.assertFalse(found)
        self.assertEqual([c[0] for c in calls], ['wmctrl'])

    def test_leaves_other_localhost_apps_alone(self):
        found, calls = self.run_with('0x01  0 0 0 1 1 localhost__other.Google-chrome host localhost:3000/dashboard\n')
        self.assertFalse(found)
        self.assertEqual([c[0] for c in calls], ['wmctrl'])

    def test_nothing_to_do_without_a_window(self):
        self.assertFalse(self.run_with('')[0])


class MonitorTest(unittest.TestCase):
    def test_prefers_the_primary_monitor(self):
        with mock.patch.object(x11, 'run', fake_run({'xrandr': XRANDR})):
            self.assertEqual(x11.primary_monitor(), (0, 0, 1920, 1080))

    def test_falls_back_to_first_connected(self):
        output = 'HDMI-1 connected 1280x720+10+20 (normal)\n'
        with mock.patch.object(x11, 'run', fake_run({'xrandr': output})):
            self.assertEqual(x11.primary_monitor(), (10, 20, 1280, 720))

    def test_default_when_xrandr_is_unavailable(self):
        with mock.patch.object(x11, 'run', fake_run({})):
            self.assertEqual(x11.primary_monitor(), (0, 0, 1920, 1080))


class WorkAreaTest(unittest.TestCase):
    def test_bottom_stops_above_the_panel(self):
        workarea = '_NET_WORKAREA(CARDINAL) = 0, 0, 1920, 1040\n'
        with mock.patch.object(x11, 'run', fake_run({'xprop': workarea})):
            self.assertEqual(x11.work_area_bottom((0, 0, 1920, 1080)), 1040)

    def test_full_monitor_without_workarea(self):
        with mock.patch.object(x11, 'run', fake_run({})):
            self.assertEqual(x11.work_area_bottom((0, 0, 1920, 1080)), 1080)

    def test_ignores_a_workarea_from_another_monitor(self):
        workarea = '_NET_WORKAREA(CARDINAL) = 0, 0, 1920, 2000\n'
        with mock.patch.object(x11, 'run', fake_run({'xprop': workarea})):
            self.assertEqual(x11.work_area_bottom((0, 0, 1920, 1080)), 1080)


class GeometryTest(unittest.TestCase):
    def test_frame_extents(self):
        with mock.patch.object(x11, 'run', fake_run({'xprop': '_NET_FRAME_EXTENTS(CARDINAL) = 1, 2, 23, 3\n'})):
            self.assertEqual(x11.frame_extents(0x1), (1, 2, 23, 3))

    def test_frame_extents_unknown(self):
        with mock.patch.object(x11, 'run', fake_run({})):
            self.assertEqual(x11.frame_extents(0x1), (0, 0, 0, 0))

    def test_client_geometry(self):
        output = '  Absolute upper-left X:  1380\n  Absolute upper-left Y:  400\n  Width: 540\n  Height: 640\n'
        with mock.patch.object(x11, 'run', fake_run({'xwininfo': output})):
            self.assertEqual(x11.client_geometry(0x1), (1380, 400, 540, 640))

    def test_start_position_is_the_bottom_right_corner(self):
        outputs = {'xrandr': XRANDR, 'xprop': '_NET_WORKAREA(CARDINAL) = 0, 0, 1920, 1040\n'}
        with mock.patch.object(x11, 'run', fake_run(outputs)):
            x, y = x11.start_position(540, 640)
        self.assertEqual((x, y), (1920 - 540 - 1, 1040 - 640 - 1))


class PlacementTest(unittest.TestCase):
    def test_moves_until_the_window_is_where_it_should_be(self):
        calls = []

        outputs = {
            'xrandr': XRANDR,
            'xwininfo': '  Absolute upper-left X:  1380\n  Absolute upper-left Y:  440\n  Width: 540\n  Height: 640\n',
        }

        def run(*command):
            calls.append(command)
            return outputs.get(command[0], '')

        with mock.patch.object(x11, 'run', run), mock.patch.object(x11.time, 'sleep'):
            x11.place_bottom_right(0x1)
        moves = [c for c in calls if c[0] == 'wmctrl']
        self.assertTrue(moves)
        self.assertEqual(moves[0][1:5], ('-i', '-r', '0x1', '-e'))


class WindowCommandsTest(unittest.TestCase):
    def setUp(self):
        self.calls = []

    def recording_run(self, outputs):
        def run(*command):
            self.calls.append(command)
            return outputs.get(command[0], '')
        return run

    def test_bring_here_does_nothing_without_a_window(self):
        with mock.patch.object(x11, 'run', self.recording_run({})), \
                mock.patch.object(x11, 'place_bottom_right') as place:
            x11.bring_here()
        place.assert_not_called()

    def test_bring_here_unhides_moves_places_and_focuses(self):
        outputs = {'wmctrl': WMCTRL_LIST, 'xprop': '_NET_CURRENT_DESKTOP(CARDINAL) = 2\n'}
        with mock.patch.object(x11, 'run', self.recording_run(outputs)), \
                mock.patch.object(x11, 'place_bottom_right') as place:
            x11.bring_here()
        place.assert_called_once_with(0x03A00007)
        flags = [c for c in self.calls if c[0] == 'wmctrl' and c[1] == '-i']
        self.assertIn(('wmctrl', '-i', '-r', '0x3a00007', '-b', 'remove,hidden'), flags)
        self.assertIn(('wmctrl', '-i', '-r', '0x3a00007', '-t', '2'), flags)
        self.assertEqual(flags[-1], ('wmctrl', '-i', '-a', '0x3a00007'))

    def test_toggle_minimizes_a_focused_window(self):
        outputs = {'wmctrl': WMCTRL_LIST, 'xprop': '_NET_CURRENT_DESKTOP(CARDINAL) = 0\n', 'xdotool': f'{0x03A00007}\n'}
        with mock.patch.object(x11, 'run', self.recording_run(outputs)), mock.patch.object(x11, 'bring_here') as bring:
            x11.toggle()
        bring.assert_not_called()
        self.assertIn(('xdotool', 'windowminimize', str(0x03A00007)), self.calls)

    def test_toggle_brings_back_a_window_that_is_not_focused(self):
        outputs = {'wmctrl': WMCTRL_LIST, 'xprop': '_NET_CURRENT_DESKTOP(CARDINAL) = 0\n', 'xdotool': '12345\n'}
        with mock.patch.object(x11, 'run', self.recording_run(outputs)), mock.patch.object(x11, 'bring_here') as bring:
            x11.toggle()
        bring.assert_called_once()

    def test_toggle_brings_the_window_when_it_is_on_another_desktop(self):
        outputs = {'wmctrl': WMCTRL_LIST.replace('0x03a00007  0', '0x03a00007  1'),
                   'xprop': '_NET_CURRENT_DESKTOP(CARDINAL) = 0\n', 'xdotool': f'{0x03A00007}\n'}
        with mock.patch.object(x11, 'run', self.recording_run(outputs)), mock.patch.object(x11, 'bring_here') as bring:
            x11.toggle()
        bring.assert_called_once()

    def test_close_window_asks_the_window_manager(self):
        with mock.patch.object(x11, 'run', self.recording_run({'wmctrl': WMCTRL_LIST})):
            x11.close_window()
        self.assertIn(('wmctrl', '-i', '-c', '0x3a00007'), self.calls)

    def test_close_window_without_a_window(self):
        with mock.patch.object(x11, 'run', self.recording_run({})):
            x11.close_window()
        self.assertEqual([c for c in self.calls if c[:2] == ('wmctrl', '-i')], [])

    def test_window_state_is_unsupported_without_a_window(self):
        with mock.patch.object(x11, 'run', self.recording_run({})):
            self.assertEqual(x11.window_state(), {'supported': False, 'alwaysOnTop': False})

    def test_window_state_reads_the_above_flag(self):
        for xprop, expected in (('_NET_WM_STATE(ATOM) = _NET_WM_STATE_ABOVE', True), ('_NET_WM_STATE(ATOM) =', False)):
            with mock.patch.object(x11, 'run', self.recording_run({'wmctrl': WMCTRL_LIST, 'xprop': xprop})):
                self.assertEqual(x11.window_state(), {'supported': True, 'alwaysOnTop': expected})

    def test_set_always_on_top_adds_or_removes_the_flag(self):
        with mock.patch.object(x11, 'run', self.recording_run({'wmctrl': WMCTRL_LIST})):
            x11.set_always_on_top(True)
            x11.set_always_on_top(False)
        self.assertIn(('wmctrl', '-i', '-r', '0x3a00007', '-b', 'add,above'), self.calls)
        self.assertIn(('wmctrl', '-i', '-r', '0x3a00007', '-b', 'remove,above'), self.calls)

    def test_set_always_on_top_without_a_window_changes_nothing(self):
        with mock.patch.object(x11, 'run', self.recording_run({})):
            x11.set_always_on_top(True)
        self.assertEqual([c for c in self.calls if c[:2] == ('wmctrl', '-i')], [])


if __name__ == '__main__':
    unittest.main()
