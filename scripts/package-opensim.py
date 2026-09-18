"""Add source attribution/build records to the staged package, then make a wheel."""

from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
build = root / ".build-opensim"
source = build / "source"
staged = build / "install/sdk/Python"
package = staged / "opensim"
for origin, name in [
    (source / "LICENSE.txt", "LICENSE.txt"),
    (source / "NOTICE", "NOTICE"),
    (source / "dependencies/simbody/LICENSE.txt", "SIMBODY-LICENSE.txt"),
    (source / "dependencies/spdlog/LICENSE", "SPDLOG-LICENSE.txt"),
]:
    shutil.copyfile(origin, package / name)


def revision(path):
    return subprocess.check_output(
        ["git", "-C", str(path), "rev-parse", "HEAD"], text=True
    ).strip()


patches = root / "biomechanics/diagnostics/wrap-cache"
provenance = {
    "packageVersion": "4.6+kinetic.wrapcache1",
    "source": "https://github.com/opensim-org/opensim-core",
    "commit": revision(source),
    "dependencies": {
        name: revision(source / "dependencies" / name) for name in ["simbody", "spdlog"]
    },
    "patchSha256": {
        p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(patches.glob("*.patch"))
    },
    "compiler": subprocess.check_output(["g++", "--version"], text=True).splitlines()[
        0
    ],
    "scope": "Source-built OpenSim with wrap-point cache invalidation. CasADi, C3D import and the desktop visualizer are excluded; native position/constraint/path/moment-arm evaluation is included.",
    "buildRecipe": "scripts/build-opensim.sh",
}
(package / "build-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
subprocess.run(
    [sys.executable, "setup.py", "bdist_wheel", "--dist-dir", str(build / "wheels")],
    cwd=staged,
    check=True,
)
