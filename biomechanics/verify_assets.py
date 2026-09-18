"""Verify the pinned upstream model, reference and display-geometry files."""

from pathlib import Path
import hashlib
import json


def verify():
    root = Path(__file__).resolve().parent / "models"
    assets = json.loads((root / "checksums.json").read_text())
    for name, expected in assets.items():
        path = root / name
        if not path.is_file():
            raise RuntimeError(
                f"Missing asset: {name}. Run npm run setup:biomechanics to fetch local hip geometry, or restore other assets from the repository; provenance is recorded in models/manifest.json."
            )
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError(
                f"Changed asset: {name}. Re-audit the model before using it."
            )
    return len(assets)


if __name__ == "__main__":
    print(f"Verified {verify()} pinned model, geometry, license and reference files.")
