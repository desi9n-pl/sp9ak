import os
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class SecondLaunchTest(unittest.TestCase):
    def test_second_launch_keeps_running_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            bin_dir = tmp / 'bin'
            bin_dir.mkdir()
            chrome = bin_dir / 'google-chrome-beta'
            chrome.write_text('#!/bin/sh\nsleep 5\n')
            chrome.chmod(0o755)
            port = free_port()
            env = {
                **os.environ,
                'PATH': f'{bin_dir}:{os.environ["PATH"]}',
                'SP9AK_PORT': str(port),
                'SP9AK_PIDFILE': str(tmp / 'pid'),
                'SP9AK_DATA': str(tmp / 'data'),
            }
            first = subprocess.Popen([str(ROOT / 'sp9ak.sh')], env=env)
            self.addCleanup(first.wait)
            self.addCleanup(first.terminate)
            for _ in range(40):
                if (tmp / 'pid').exists():
                    break
                time.sleep(0.1)
            time.sleep(0.5)
            second = subprocess.run([str(ROOT / 'sp9ak.sh')], env=env, timeout=10)
            self.assertEqual(second.returncode, 0)
            with urllib.request.urlopen(f'http://localhost:{port}/', timeout=3) as r:
                self.assertEqual(r.status, 200)


    def test_terminating_the_launcher_stops_the_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            bin_dir = tmp / 'bin'
            bin_dir.mkdir()
            chrome = bin_dir / 'google-chrome-beta'
            chrome.write_text(f'#!/bin/sh\ntouch {tmp}/started\nsleep 30\n')
            chrome.chmod(0o755)
            env = {
                **os.environ,
                'PATH': f'{bin_dir}:{os.environ["PATH"]}',
                'SP9AK_PORT': str(free_port()),
                'SP9AK_PIDFILE': str(tmp / 'pid'),
                'SP9AK_DATA': str(tmp / 'data'),
            }
            launcher = subprocess.Popen([str(ROOT / 'sp9ak.sh')], env=env)
            self.addCleanup(launcher.kill)
            for _ in range(100):
                if (tmp / 'started').exists():  # the launcher has installed its trap by now
                    break
                time.sleep(0.1)
            server_pid = int((tmp / 'pid').read_text())
            launcher.terminate()
            launcher.wait(timeout=10)
            for _ in range(30):
                try:
                    os.kill(server_pid, 0)
                except ProcessLookupError:
                    return
                time.sleep(0.1)
            self.fail('server survived the launcher')


if __name__ == '__main__':
    unittest.main()
