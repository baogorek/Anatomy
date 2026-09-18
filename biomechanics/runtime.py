"""Identify and verify the native calculation package separately from model data."""

from functools import lru_cache
from importlib.metadata import version
from pathlib import Path
import hashlib
import json

import opensim

ROOT = Path(__file__).resolve().parent
PACKAGE_VERSION = "4.6+kinetic.wrapcache1"
ADAPTER_VERSION = "kinetic-geometry-v3"


@lru_cache(maxsize=1)
def native_identity():
    directory = Path(opensim.__file__).resolve().parent
    # Include the native engine and numerical dependencies, not just the model
    # checksum. Diagnostics can still identify the original, unpatched package.
    binaries = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(directory.glob("*.so*"))
        if path.is_file() and not path.is_symlink()
    }
    identity = {
        "packageVersion": version("opensim"),
        "engine": opensim.GetVersionAndDate(),
        "numpyVersion": version("numpy"),
        "binaries": binaries,
    }
    identity["id"] = hashlib.sha256(
        json.dumps(identity, sort_keys=True).encode()
    ).hexdigest()
    return identity


def calculation_version(model_hash):
    return hashlib.sha256(
        f"{ADAPTER_VERSION}:{model_hash}:{native_identity()['id']}".encode()
    ).hexdigest()


def verify_runtime():
    actual = native_identity()
    expected = json.loads((ROOT / "runtime-manifest.json").read_text())
    if (
        actual["packageVersion"] != PACKAGE_VERSION
        or "+kinetic.wrapcache1" not in actual["engine"]
        or actual["id"] != expected["native"]["id"]
    ):
        raise RuntimeError(
            "The corrected OpenSim package is required. Run npm run setup:biomechanics."
        )
    return actual


if __name__ == "__main__":
    print(json.dumps(verify_runtime(), indent=2))
