"""Window placement for X11 desktops, built on wmctrl, xdotool, xprop, xwininfo and xrandr."""
import re
import subprocess
import sys
import time

WINDOW_TITLE = 'sp9ak'
MARGIN = 0                 # gap to the screen edge (0 = flush with the corner)
TYPICAL_FRAME = (1, 1, 23, 1)   # window-manager frame (left, right, top, bottom) before a window exists
TOOL_TIMEOUT_S = 3
PLACEMENT_RETRIES = 2
SETTLE_DELAY_S = 0.15
STATE_POLLS = 6            # the window manager applies a state change asynchronously
STATE_POLL_DELAY_S = 0.08


def run(*command):
    """stdout of an external tool, or '' if it is missing or fails."""
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=TOOL_TIMEOUT_S).stdout
    except (OSError, subprocess.SubprocessError):
        return ''


def find_window():
    """Id of the app's Chrome window, or None while it does not exist yet."""
    for line in run('wmctrl', '-lGx').splitlines():
        fields = line.split(None, 8)
        if len(fields) >= 9 and fields[8].strip() == WINDOW_TITLE and 'localhost' in fields[6].lower():
            return int(fields[0], 16)
    return None


def primary_monitor():
    """(x, y, width, height) of the primary monitor, else of the first connected one."""
    monitors = []
    for line in run('xrandr', '--query').splitlines():
        match = re.search(r' connected( primary)? (\d+)x(\d+)\+(\d+)\+(\d+)', line)
        if match:
            width, height, x, y = map(int, match.groups()[1:])
            monitors.append((bool(match.group(1)), (x, y, width, height)))
    monitors.sort(key=lambda m: not m[0])
    return monitors[0][1] if monitors else (0, 0, 1920, 1080)


def work_area_bottom(monitor):
    """Bottom edge of the usable area (above the taskbar) on `monitor`."""
    bottom = monitor[1] + monitor[3]
    match = re.search(r'=\s*(\d+), (\d+), (\d+), (\d+)', run('xprop', '-root', '_NET_WORKAREA'))
    if match:
        _, y, _, height = map(int, match.groups())
        if monitor[1] < y + height <= bottom:
            bottom = y + height
    return bottom


def frame_extents(window):
    """(left, right, top, bottom) thickness of the window manager's frame."""
    match = re.search(r'=\s*(\d+), (\d+), (\d+), (\d+)', run('xprop', '-id', hex(window), '_NET_FRAME_EXTENTS'))
    return tuple(map(int, match.groups())) if match else (0, 0, 0, 0)


def client_geometry(window):
    """(x, y, width, height) of the window contents on screen."""
    output = run('xwininfo', '-id', str(window))

    def read(label):
        match = re.search(label + r':\s*(-?\d+)', output)
        return int(match.group(1)) if match else 0

    return read('Absolute upper-left X'), read('Absolute upper-left Y'), read('Width'), read('Height')


def place_bottom_right(window):
    """Moves the window to the bottom-right corner of the primary monitor's work area."""
    monitor = primary_monitor()
    left, right, top, bottom = frame_extents(window)
    _, _, width, height = client_geometry(window)
    target_x = monitor[0] + monitor[2] - width - right - MARGIN
    target_y = work_area_bottom(monitor) - height - bottom - MARGIN
    # Some window managers shift windows by their frame; correct from the measured result.
    error_x = error_y = 0
    for _ in range(PLACEMENT_RETRIES):
        run('wmctrl', '-i', '-r', hex(window), '-e',
            f'0,{target_x - left - error_x},{target_y - top - error_y},{width},{height}')
        time.sleep(SETTLE_DELAY_S)
        x, y, _, _ = client_geometry(window)
        error_x, error_y = error_x + (x - target_x), error_y + (y - target_y)
        if (x, y) == (target_x, target_y):
            break


def current_desktop():
    match = re.search(r'=\s*(\d+)', run('xprop', '-root', '_NET_CURRENT_DESKTOP'))
    return match.group(1) if match else '0'


def bring_here():
    """Un-minimizes the window, moves it to the current desktop and corner, and focuses it."""
    window = find_window()
    if window is None:
        return
    run('wmctrl', '-i', '-r', hex(window), '-b', 'remove,hidden')
    run('wmctrl', '-i', '-r', hex(window), '-t', current_desktop())
    place_bottom_right(window)
    run('wmctrl', '-i', '-a', hex(window))


def is_focused_here(window):
    """True when the window is on the current desktop and has the focus."""
    on_current_desktop = False
    for line in run('wmctrl', '-l').splitlines():
        fields = line.split()
        if int(fields[0], 16) == window:
            on_current_desktop = fields[1] == current_desktop()
    return on_current_desktop and run('xdotool', 'getactivewindow').strip() == str(window)


def toggle():
    """Minimizes the window if it is in front, otherwise brings it here."""
    window = find_window()
    if window is not None and is_focused_here(window):
        run('xdotool', 'windowminimize', str(window))
    else:
        bring_here()


def is_always_on_top(window):
    return '_NET_WM_STATE_ABOVE' in run('xprop', '-id', hex(window), '_NET_WM_STATE')


def window_state():
    """What the page may offer: `supported` is False without wmctrl or while the window is not found."""
    window = find_window()
    if window is None:
        return {'supported': False, 'alwaysOnTop': False}
    return {'supported': True, 'alwaysOnTop': is_always_on_top(window)}


def set_always_on_top(enabled):
    """Pins or unpins the window above all others; returns the state the window manager really ended up in."""
    window = find_window()
    if window is not None:
        run('wmctrl', '-i', '-r', hex(window), '-b', f"{'add' if enabled else 'remove'},above")
        for _ in range(STATE_POLLS):
            if is_always_on_top(window) == enabled:
                break
            time.sleep(STATE_POLL_DELAY_S)
    return window_state()


def close_window():
    window = find_window()
    if window is not None:
        run('wmctrl', '-i', '-c', hex(window))


def start_position(width, height):
    """Where Chrome's `--window-position` should put a window of this size, before it exists."""
    monitor = primary_monitor()
    _, right, _, bottom = TYPICAL_FRAME
    return (monitor[0] + monitor[2] - width - right - MARGIN,
            work_area_bottom(monitor) - height - bottom - MARGIN)


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--position':
        x, y = start_position(int(sys.argv[2]), int(sys.argv[3]))
        print(f'{x},{y}')
    else:
        sys.exit('usage: python -m desktop.x11 --position WIDTH HEIGHT')
