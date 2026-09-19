"""Shared development/production HTTP app; one process owns the native models."""
import gzip
from http import HTTPStatus
import json
import mimetypes
import os
from pathlib import Path
from threading import BoundedSemaphore, Lock
from urllib.parse import parse_qs
from wsgiref.util import FileWrapper
from engine import ModelEngine, VERSION
from verify_assets import verify
from runtime import verify_runtime
from longest_path import SearchJobs, SEARCH_VERSION

verify()
NATIVE = verify_runtime()
ENGINES = {region: ModelEngine(region) for region in ("shoulder", "hip", "arm", "neck", "spine", "wholebody")}
LOCK = Lock()  # OpenSim model/state objects are never evaluated concurrently.
ADMISSION = BoundedSemaphore(3)
SEARCHES = SearchJobs(ENGINES, LOCK)
DIST = Path(os.environ.get("MOVEMENT_LAB_DIST", Path(__file__).resolve().parents[1] / "dist")).resolve()


def encoded(value):
    return json.dumps(value, allow_nan=False, separators=(",", ":")).encode()


# Model configs contain immutable reference geometry. Serialize once at startup.
CONFIGS = {region: encoded(engine.config()) for region, engine in ENGINES.items()}
CONFIGS_GZIP = {region: gzip.compress(body) for region, body in CONFIGS.items()}


def reply(start_response, status, value, headers=(), *, head=False):
    body = value if isinstance(value, bytes) else encoded(value)
    start_response(f"{status} {HTTPStatus(status).phrase}", [
        ("Content-Type", "application/json"), ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff"), *headers,
    ])
    return [] if head else [body]


def static_file(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET")
    if method not in ("GET", "HEAD"):
        return reply(start_response, 405, dict(error="Method not allowed"))
    if path in ("/movement-lab", "/movement-lab/"):
        relative = "index.html"
    elif path.startswith("/movement-lab/"):
        relative = path[len("/movement-lab/"):]
    else:
        return reply(start_response, 404, dict(error="Unknown endpoint"))
    target = (DIST / relative).resolve()
    if not target.is_relative_to(DIST) or not target.is_file():
        return reply(start_response, 404, dict(error="File not found"))
    stat = target.stat()
    etag = f'W/"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
    cache = "public, max-age=31536000, immutable" if relative.startswith("assets/") else "public, max-age=0, must-revalidate"
    headers = [("Cache-Control", cache), ("ETag", etag), ("X-Content-Type-Options", "nosniff")]
    headers.append(("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream"))
    compressed = target.with_name(target.name + ".gz")
    if compressed.is_file():
        headers.append(("Vary", "Accept-Encoding"))
        if "gzip" in environ.get("HTTP_ACCEPT_ENCODING", ""):
            target = compressed
            headers.append(("Content-Encoding", "gzip"))
    if environ.get("HTTP_IF_NONE_MATCH") == etag:
        start_response("304 Not Modified", headers)
        return []
    headers.append(("Content-Length", str(target.stat().st_size)))
    start_response("200 OK", headers)
    return [] if method == "HEAD" else FileWrapper(target.open("rb"))


def application(environ, start_response):
    path = environ.get("PATH_INFO", "")
    method = environ.get("REQUEST_METHOD", "GET")
    if not path.startswith("/api/biomechanics/"):
        return static_file(environ, start_response)
    owner = environ.get("HTTP_X_MOVEMENT_SESSION") or None
    if owner is not None and (len(owner) > 64 or not all(c.isalnum() or c == "-" for c in owner)):
        return reply(start_response, 400, dict(error="Invalid search session"))
    if path == "/api/biomechanics/health" and method in ("GET", "HEAD"):
        return reply(start_response, 200, dict(
            service="kinetic-opensim", engine=VERSION, calculationBuild=NATIVE["id"],
            regions=list(ENGINES), longestPathSearch=SEARCH_VERSION,
        ), head=method == "HEAD")
    if path == "/api/biomechanics/config" and method == "GET":
        region = parse_qs(environ.get("QUERY_STRING", "")).get("region", ["shoulder"])[0]
        if region not in CONFIGS:
            return reply(start_response, 400, dict(error="Unknown region"))
        if "gzip" in environ.get("HTTP_ACCEPT_ENCODING", ""):
            return reply(start_response, 200, CONFIGS_GZIP[region], [("Content-Encoding", "gzip"), ("Vary", "Accept-Encoding")])
        return reply(start_response, 200, CONFIGS[region], [("Vary", "Accept-Encoding")])
    if path.startswith("/api/biomechanics/longest-path/") and method in ("GET", "DELETE"):
        result = SEARCHES.get(path.rsplit("/", 1)[-1], cancel=method == "DELETE", owner=owner)
        return reply(start_response, 200 if result else 404,
                     (dict(status="cancelled") if method == "DELETE" else result) if result
                     else dict(error="Search expired. Start a new search."))
    if method != "POST" or path not in ("/api/biomechanics/pose", "/api/biomechanics/longest-path"):
        return reply(start_response, 404, dict(error="Unknown endpoint"))
    if environ.get("CONTENT_TYPE", "").split(";")[0] != "application/json":
        return reply(start_response, 415, dict(error="Send a JSON request"))
    if not ADMISSION.acquire(blocking=False):
        return reply(start_response, 503, dict(error="The movement service is busy. Please try again."), [("Retry-After", "1")])
    try:
        size = int(environ.get("CONTENT_LENGTH") or "0")
        if not 0 < size <= 16384:
            return reply(start_response, 413, dict(error="Invalid request size"))
        request = json.loads(environ["wsgi.input"].read(size))
        if not isinstance(request, dict) or request.get("region") not in ENGINES:
            raise ValueError("Unknown region")
        if path == "/api/biomechanics/longest-path":
            try:
                return reply(start_response, 202, SEARCHES.start(request, owner=owner))
            except ValueError as error:
                return reply(start_response, 400, dict(error=str(error)))
            except RuntimeError as error:
                return reply(start_response, 409, dict(error=str(error)))
        with LOCK:
            pose = ENGINES[request["region"]].evaluate(request)
        return reply(start_response, 200, pose)
    except (ValueError, TypeError, AttributeError):
        return reply(start_response, 400, dict(error="This pose is outside the supported controls. Reset the pose and try again."))
    except Exception as error:
        print("OpenSim evaluation failed:", error, flush=True)
        return reply(start_response, 422, dict(error="OpenSim could not resolve this pose. No length result is available."))
    finally:
        ADMISSION.release()
