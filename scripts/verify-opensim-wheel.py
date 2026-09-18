"""Check the bundled installation artifact before handing it to pip/uv."""

from pathlib import Path
import hashlib
import json
import platform
import sys

root = Path(__file__).resolve().parents[1]
if (
    sys.version_info[:2] != (3, 12)
    or platform.system() != "Linux"
    or platform.machine() != "x86_64"
):
    raise SystemExit(
        "The bundled corrected OpenSim wheel requires Linux x86_64 and Python 3.12."
    )
manifest = json.loads((root / "biomechanics/runtime-manifest.json").read_text())
wheel = root / manifest["wheel"]["path"]
if hashlib.sha256(wheel.read_bytes()).hexdigest() != manifest["wheel"]["sha256"]:
    raise SystemExit(
        "OpenSim wheel checksum mismatch; restore the pinned artifact before installing."
    )
print("Verified corrected OpenSim wheel:", wheel.name)
