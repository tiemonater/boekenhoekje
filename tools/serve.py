"""Local test server that tells the browser never to keep old copies,
so your iPhone always loads the newest version while we build.
Run from the project folder:  python3 tools/serve.py
"""
import http.server

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler).serve_forever()
