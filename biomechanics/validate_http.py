"""Exercise deployment HTTP behavior and isolation against a running service."""
import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

origin = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8910"


def request(path, method="GET", data=None, owner=None, headers=None):
    headers = dict(headers or {})
    if owner:
        headers["X-Movement-Session"] = owner
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(origin + path, method=method, data=json.dumps(data).encode() if data is not None else None, headers=headers)
    try:
        response = urlopen(req, timeout=45)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        return response.status, {k.lower(): v for k, v in response.headers.items()}, json.loads(body) if body and "application/json" in response.headers.get("Content-Type", "") else body


assert request("/api/biomechanics/health")[0] == 200
assert request("/api/biomechanics/config?region=unknown")[0] == 400
assert request("/api/biomechanics/pose", "POST", {})[0] == 400
assert request("/api/biomechanics/pose", "POST", {"region": "neck", "padding": "x" * 17000})[0] == 413
assert request("/movement-lab/../biomechanics/runtime-manifest.json")[0] == 404
assert request("/movement-lab/missing.js")[0] == 404
status, headers, body = request("/movement-lab/")
assert status == 200 and b"/movement-lab/assets/" in body
assert request("/movement-lab/", headers={"If-None-Match": headers["etag"]})[0] == 304
_, _, config = request("/api/biomechanics/config?region=neck")
muscle = next(m["id"] for m in config["muscles"] if m["name"] == "Left Anterior scalene")
payload = dict(region="neck", version=config["version"], muscle=muscle,
               coordinates={c["id"]: c["default"] for c in config["controls"]}, controls=[c["id"] for c in config["controls"]])
status, _, job = request("/api/biomechanics/longest-path", "POST", payload, owner="visitor-one")
assert status == 202
path = "/api/biomechanics/longest-path/" + job["id"]
assert request(path, owner="visitor-two")[0] == 404
assert request(path, "DELETE", owner="visitor-two")[0] == 404
assert request("/api/biomechanics/longest-path", "POST", payload, owner="visitor-two")[0] == 409
assert request("/api/biomechanics/pose", "POST", {"region": "hip"})[0] == 200
deadline = time.monotonic() + 45
while time.monotonic() < deadline:
    status, _, job = request(path, owner="visitor-one")
    assert status == 200 and "owner" not in job
    if job["status"] != "running":
        break
    time.sleep(.3)
assert job["status"] == "complete", job
assert job["result"]["gain"] > 0
assert request(path, "DELETE", owner="visitor-one")[0] == 200
print("HTTP checks passed: model evaluation, request bounds, static routing/cache, concurrent visitors, search ownership and completion.")
