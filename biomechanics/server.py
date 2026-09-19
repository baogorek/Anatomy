"""Development entry point; production uses the same WSGI app through Gunicorn."""
import os
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler, make_server
from service import application

class DevelopmentServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True

class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    print(f"OpenSim ready at http://127.0.0.1:{port}", flush=True)
    make_server("127.0.0.1", port, application, DevelopmentServer, QuietHandler).serve_forever()
