"""Bundle a tested wheel and record the identity observed in its isolated install.

Run using the Python interpreter into which the candidate wheel was installed.
The full native/browser regression suite must also pass before shipping it.
"""

from pathlib import Path
import hashlib
import json
import os
import shutil
import sys
import opensim

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "biomechanics"))
from runtime import native_identity, PACKAGE_VERSION
from engine import ModelEngine

if len(sys.argv) != 2:
    raise SystemExit(
        "Usage: candidate-python scripts/record-opensim-runtime.py candidate.whl"
    )
if os.environ.get("LD_PRELOAD"):
    raise SystemExit("Record the installed native package without LD_PRELOAD.")
wheel = Path(sys.argv[1]).resolve()
native = native_identity()
assert native["packageVersion"] == PACKAGE_VERSION
assert "+kinetic.wrapcache1" in native["engine"]
provenance = json.loads(
    (Path(opensim.__file__).resolve().parent / "build-provenance.json").read_text()
)
assert provenance["commit"] == "85aaf6450a2f22457dac4d1ab35adfed9d3a8e43"
model = ModelEngine("hip")
for request in [
    {},
    {"coordinates": {"ankle_angle_r": 20}},
    {"coordinates": {"ankle_angle_r": 20, "knee_angle_r": 90}},
]:
    pose = model.evaluate(request)
    for muscle in pose["muscles"]:
        if muscle["id"] in ["gasmed_r", "gaslat_r"]:
            assert muscle["available"] and muscle["pathErrorMm"] < 0.02
destination = root / "biomechanics/wheels" / wheel.name
destination.parent.mkdir(exist_ok=True)
shutil.copyfile(wheel, destination)
manifest = {
    "native": native,
    "wheel": {
        "path": str(destination.relative_to(root)),
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
    },
    "provenance": provenance,
    "platform": "Linux x86_64 / CPython 3.12; system libblas and liblapack required",
}
(root / "biomechanics/runtime-manifest.json").write_text(
    json.dumps(manifest, indent=2) + "\n"
)
(root / "biomechanics/requirements.txt").write_text(
    "numpy==2.5.3\n./" + str(destination.relative_to(root)) + "\n"
)
print("Recorded corrected native package", native["id"])
