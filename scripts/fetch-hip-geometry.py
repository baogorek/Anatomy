"""Fetch pinned hip display meshes directly from upstream; verify before saving.

These files stay local instead of being redistributed in this repository.
Source attribution and the unresolved individual terms are in biomechanics/README.md.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geometry-dir", type=Path, default=ROOT / "biomechanics/models/hip/Geometry")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "biomechanics/models/manifest.json").read_text())["hip"]
    checksums = json.loads((ROOT / "biomechanics/models/checksums.json").read_text())
    source = manifest["geometrySource"]
    args.geometry_dir.mkdir(parents=True, exist_ok=True)

    def fetch(name):
        expected = checksums[f"hip/Geometry/{name}"]
        target = args.geometry_dir / name
        if target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
                raise RuntimeError(f"Local geometry changed: {target}. Restore or re-audit it before setup.")
            return False
        url = f"https://raw.githubusercontent.com/{source['repository']}/{source['commit']}/{quote(source['paths'][name])}"
        with urlopen(url, timeout=60) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError(f"Upstream checksum mismatch: {name}. Nothing saved.")
        target.write_bytes(data)
        return True

    with ThreadPoolExecutor(max_workers=6) as pool:
        downloaded = sum(pool.map(fetch, manifest["geometryFiles"]))
    print(f"Verified {len(manifest['geometryFiles'])} hip display meshes; downloaded {downloaded} from pinned upstream source.")


if __name__ == "__main__":
    main()
