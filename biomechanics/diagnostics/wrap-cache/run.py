"""Reproduce the stock/patched comparison without changing the installed engine.

The diagnostic interposer is specific to the recorded Linux wheel ABI. A real
engine integration should compile the accompanying source patch into OpenSim.
"""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import opensim

HERE = Path(__file__).resolve().parent
library = Path(opensim.__file__).resolve().parent
checksums = json.loads((HERE / "library-checksums.json").read_text())
for name, expected in checksums.items():
    path = library / name
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit("Diagnostic requires the recorded Linux OpenSim wheel: " + name)

with tempfile.TemporaryDirectory(prefix="kinetic-wrap-cache-") as directory:
    shared = Path(directory) / "cache_probe.so"
    subprocess.run(
        ["g++", "-std=c++17", "-O2", "-fPIC", "-shared",
         str(HERE / "cache_probe.cpp"), "-ldl", "-o", str(shared)],
        check=True,
    )
    result = {}
    for mode in ["stock", "cacheInvalidationProbe"]:
        env = os.environ.copy()
        env.pop("LD_PRELOAD", None)
        if mode != "stock":
            env["LD_PRELOAD"] = str(shared)
        completed = subprocess.run(
            [sys.executable, str(HERE / "probe.py")],
            env=env, check=True, text=True, capture_output=True,
        )
        result[mode] = json.loads(completed.stdout)
        if mode != "stock":
            if "Diagnostic wrap cache invalidations:" not in completed.stderr:
                raise AssertionError("Diagnostic hook was not called")
            for stats in result[mode]["summary"].values():
                assert stats["withheld"] == 0
                assert stats["maxPathErrorMm"] < 0.02
                assert stats["maxCachedPointErrorMm"] == 0
                assert stats["maxRepeatErrorMm"] < 1e-6
            assert result[mode]["maxMomentArmErrorMm"] < 0.05
    assert all(s["withheld"] > 0 for s in result["stock"]["summary"].values())
    print(json.dumps(result, indent=2))
