"""Local, serialized OpenSim calculations exposed to the browser through Vite."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import urlparse, parse_qs
import json
from engine import ModelEngine, VERSION
from verify_assets import verify
from runtime import verify_runtime
from longest_path import SearchJobs, SEARCH_VERSION

verify()
NATIVE = verify_runtime()

ENGINES = {region: ModelEngine(region) for region in ("shoulder", "hip", "arm", "neck", "spine", "wholebody")}
LOCK = Lock()  # OpenSim model/state objects are never evaluated concurrently.
SEARCHES = SearchJobs(ENGINES, LOCK)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, value):
        body = json.dumps(value, allow_nan=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/biomechanics/health":
            return self.reply(
                200,
                dict(
                    service="kinetic-opensim",
                    engine=VERSION,
                    calculationBuild=NATIVE["id"],
                    regions=list(ENGINES),
                    longestPathSearch=SEARCH_VERSION,
                ),
            )
        if url.path.startswith("/api/biomechanics/longest-path/"):
            result = SEARCHES.get(url.path.rsplit("/", 1)[-1])
            return self.reply(200 if result else 404, result or dict(error="Search expired. Start a new search."))
        if url.path != "/api/biomechanics/config":
            return self.reply(404, dict(error="Unknown endpoint"))
        region = parse_qs(url.query).get("region", ["shoulder"])[0]
        if region not in ENGINES:
            return self.reply(400, dict(error="Unknown region"))
        with LOCK:
            self.reply(200, ENGINES[region].config())

    def do_POST(self):
        if self.path not in ("/api/biomechanics/pose", "/api/biomechanics/longest-path"):
            return self.reply(404, dict(error="Unknown endpoint"))
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 16384:
                raise ValueError("Invalid request size")
            request = json.loads(self.rfile.read(size))
            if not isinstance(request, dict) or request.get("region") not in ENGINES:
                raise ValueError("Unknown region")
            if self.path == "/api/biomechanics/longest-path":
                try:
                    return self.reply(202, SEARCHES.start(request))
                except ValueError as error:
                    return self.reply(400, dict(error=str(error)))
                except RuntimeError as error:
                    return self.reply(409, dict(error=str(error)))
            with LOCK:
                pose = ENGINES[request["region"]].evaluate(request)
            self.reply(200, pose)
        except (ValueError, TypeError, AttributeError):
            self.reply(
                400,
                dict(
                    error="This pose is outside the supported controls. Reset the pose and try again."
                ),
            )

        except Exception as error:
            print("OpenSim evaluation failed:", error, flush=True)
            self.reply(
                422,
                dict(
                    error="OpenSim could not resolve this pose. No length result is available."
                ),
            )

    def do_DELETE(self):
        if not self.path.startswith("/api/biomechanics/longest-path/"):
            return self.reply(404, dict(error="Unknown endpoint"))
        result = SEARCHES.get(self.path.rsplit("/", 1)[-1], cancel=True)
        self.reply(200 if result else 404, dict(status="cancelled") if result else dict(error="Search expired."))


if __name__ == "__main__":
    print("OpenSim ready at http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
