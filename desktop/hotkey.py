"""Global keyboard shortcut (X11) that works even while the window is hidden.
Uses XGrabKey through python-xlib; a background thread calls back on each press."""
import threading
import traceback

DEFAULT_HOTKEY = 'ctrl+F11'
DEFAULT_HOTKEY_STOP = 'ctrl+shift+F11'

_MODS = {'ctrl': 'ControlMask', 'control': 'ControlMask', 'shift': 'ShiftMask',
         'alt': 'Mod1Mask', 'super': 'Mod4Mask', 'win': 'Mod4Mask'}


def parse_hotkey(spec):
    """'ctrl+alt+F11' -> (['ControlMask', 'Mod1Mask'], 'F11'). Raises ValueError on bad input."""
    parts = [p.strip() for p in (spec or '').split('+') if p.strip()]
    if len(parts) < 2:
        raise ValueError(f'Skrót musi mieć modyfikator i klawisz: {spec!r}')
    *mods, key = parts
    masks = []
    for m in mods:
        name = _MODS.get(m.lower())
        if not name:
            raise ValueError(f'Nieznany modyfikator: {m!r}')
        if name not in masks:
            masks.append(name)
    return masks, key


# CapsLock and NumLock must not disable the shortcut, so every combination is grabbed.
def _lock_variants(X):
    return [0, X.LockMask, X.Mod2Mask, X.LockMask | X.Mod2Mask]


class GlobalHotkey:
    """Grabs the shortcut on the root window. start() returns None or an error message."""

    def __init__(self, spec, callback):
        self.spec = spec
        self.callback = callback
        self._display = None
        self._keycode = 0
        self._modifiers = 0

    def start(self):
        try:
            from Xlib import XK, X, display
            masks, key = parse_hotkey(self.spec)
        except (ImportError, ValueError) as e:
            return str(e)
        try:
            self._display = display.Display()
        except Exception as e:  # Xlib raises assorted connection errors
            return f'Brak połączenia z X11: {e}'

        keysym = XK.string_to_keysym(key)
        self._keycode = self._display.keysym_to_keycode(keysym) if keysym else 0
        if not self._keycode:
            return f'Nieznany klawisz: {key!r}'
        self._modifiers = 0
        for mask in masks:
            self._modifiers |= getattr(X, mask)

        errors = []
        root = self._display.screen().root
        for lock in _lock_variants(X):
            root.grab_key(self._keycode, self._modifiers | lock, True, X.GrabModeAsync, X.GrabModeAsync,
                          onerror=lambda err, *_: errors.append(err))
        self._display.sync()
        if errors:
            return f'Skrót {self.spec} jest już zajęty przez inną aplikację'

        threading.Thread(target=self._listen, args=(X,), daemon=True).start()
        return None

    def _listen(self, X):
        ignored = X.LockMask | X.Mod2Mask
        while True:
            event = self._display.next_event()
            if event.type == X.KeyPress and event.detail == self._keycode \
                    and (event.state & ~ignored) == self._modifiers:
                try:
                    self.callback()
                except Exception:  # a failing callback must not kill the listener
                    traceback.print_exc()
