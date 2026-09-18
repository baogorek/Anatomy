"""Convert the preserved BodyParts3D OBJ subset into a resting browser reference.

Run: python3 scripts/export-tfl-reference.py
All six parts retain their shared source placement. Only millimetres -> metres
and the proper rotation (x, y, z) -> (x, z, -y) are applied; no registration,
skinning, smoothing, or independent part transforms are performed.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models/muscle-reference"
PARTS = [
    ("FJ1438", "FMA22425", "Right tensor fasciae latae", "muscle"),
    ("FJ1423", "FMA58776", "Right iliotibial tract", "fascia"),
    ("FJ3152", "FMA16586", "Right hip bone", "bone"),
    ("FJ3365", "FMA24474", "Right femur", "bone"),
    ("FJ3387", "FMA24477", "Right tibia", "bone"),
    ("FJ3366", "FMA24480", "Right fibula", "bone"),
]
meshes, sources = [], []
for file_id, concept, name, tissue in PARTS:
    raw = (OUT / "bodyparts3d-source" / f"{file_id}.obj").read_bytes()
    text = raw.decode()
    assert f"# Concept ID : {concept}" in text
    assert f"# English name : {name}" in text
    points, indices = [], []
    for line in text.splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            x, y, z = map(float, fields[1:4])
            points.extend([x / 1000, z / 1000, -y / 1000])
        elif fields[0] == "f":
            face = [int(f.split("/")[0]) for f in fields[1:]]
            face = [i - 1 if i > 0 else len(points) // 3 + i for i in face]
            for i in range(1, len(face) - 1):
                indices.extend([face[0], face[i], face[i + 1]])
    assert points and indices and len(indices) % 3 == 0
    assert all(math.isfinite(v) for v in points)
    assert min(indices) >= 0 and max(indices) < len(points) // 3
    assert max(points[0::3]) < 0, "Expected right-sided geometry"
    meshes.append(dict(name=name, positions=points, indices=indices,
                       bone=tissue == "bone", fascia=tissue == "fascia", region="hip"))
    sources.append(dict(file=f"{file_id}.obj", concept=concept, name=name,
                        sha256=hashlib.sha256(raw).hexdigest(),
                        vertices=len(points) // 3, triangles=len(indices) // 3))
asset = dict(schema=1, dataset="bodyparts3d-tfl", meshes=meshes, missingNames=[],
             sources=sources,
             archive="https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
             license="CC-BY-4.0",
             licenseUrl="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
             attribution="BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
             transform="metres: (source x, source z, -source y) / 1000; shared across all parts")
(OUT / "bodyparts3d-tfl.json").write_text(json.dumps(asset, separators=(",", ":")))
print(json.dumps(sources, indent=2))
