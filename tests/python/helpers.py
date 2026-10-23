import io
import json
import urllib.error


class FakeResponse:
    """Stands in for the context manager returned by urllib.request.urlopen."""

    def __init__(self, payload):
        self._body = json.dumps(payload).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(code, body):
    raw = body if isinstance(body, bytes) else json.dumps(body).encode()
    return urllib.error.HTTPError('https://example.test', code, 'error', {}, io.BytesIO(raw))
