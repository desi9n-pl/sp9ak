"""Tray icon for sp9ak. Clicking it shows or hides the window; two global shortcuts
start and stop dictation even when the window is hidden."""
import contextlib
import json
import os
import sys
import urllib.error
import urllib.request

import gi

gi.require_version('Gtk', '3.0')
from gi.repository import GLib, Gtk  # noqa: E402

from . import x11  # noqa: E402
from .hotkey import DEFAULT_HOTKEY, DEFAULT_HOTKEY_STOP, GlobalHotkey  # noqa: E402

PORT = int(os.environ.get('SP9AK_PORT', 17823))
HOTKEY_START = os.environ.get('SP9AK_HOTKEY', DEFAULT_HOTKEY)
HOTKEY_STOP = os.environ.get('SP9AK_HOTKEY_STOP', DEFAULT_HOTKEY_STOP)
ICON = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.svg')

WINDOW_POLL_MS = 100       # short, so the address Chrome shows while loading is replaced almost at once
WINDOW_POLL_ATTEMPTS = 300  # 30 s: Chrome creates its window with a delay
REQUEST_TIMEOUT_S = 2


def send_hotkey(action):
    """Tells the page (through the local server) to start or stop dictating."""
    request = urllib.request.Request(
        f'http://127.0.0.1:{PORT}/api/hotkey',
        data=json.dumps({'action': action}).encode(),
        method='POST',
    )
    # a missing server just means the app is closing
    with contextlib.suppress(urllib.error.URLError, OSError):
        urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S)


def on_start_hotkey():
    # callbacks arrive on the hotkey thread; GTK and the window tools belong to the main loop
    def start_dictation():
        x11.bring_here()
        send_hotkey('start')
        return False
    GLib.idle_add(start_dictation)


def on_stop_hotkey():
    def stop_dictation():
        send_hotkey('stop')
        return False
    GLib.idle_add(stop_dictation)


class WindowPlacer:
    """GLib timeout callback: titles the window while it loads, places it once the title is final, then stops."""

    def __init__(self):
        self.attempts = 0

    def __call__(self):
        window = x11.find_window()
        if window is not None:
            x11.place_bottom_right(window)
            return False
        x11.retitle_loading_window()
        self.attempts += 1
        return self.attempts < WINDOW_POLL_ATTEMPTS


def build_menu():
    menu = Gtk.Menu()
    show = Gtk.MenuItem(label='Pokaż sp9ak')
    show.connect('activate', lambda *_: x11.bring_here())
    quit_item = Gtk.MenuItem(label='Zamknij sp9ak')
    quit_item.connect('activate', lambda *_: quit_app())
    menu.append(show)
    menu.append(quit_item)
    menu.show_all()
    return menu


def show_menu(menu, icon, button, time):
    menu.popup(None, None, Gtk.StatusIcon.position_menu, icon, button, time)


def quit_app():
    x11.close_window()
    Gtk.main_quit()


def main():
    icon = Gtk.StatusIcon.new_from_file(ICON)
    icon.set_tooltip_text(f'sp9ak – kliknij lub {HOTKEY_START} (start) / {HOTKEY_STOP} (stop)')
    icon.connect('activate', lambda *_: x11.toggle())
    menu = build_menu()
    icon.connect('popup-menu', lambda i, button, time: show_menu(menu, i, button, time))

    for spec, callback in ((HOTKEY_START, on_start_hotkey), (HOTKEY_STOP, on_stop_hotkey)):
        error = GlobalHotkey(spec, callback).start()
        if error:
            print(f'sp9ak: skrót globalny wyłączony – {error}', file=sys.stderr)

    GLib.timeout_add(WINDOW_POLL_MS, WindowPlacer())
    Gtk.main()


if __name__ == '__main__':
    main()
