"""Check packaged poses against fresh native evaluations and raw atlas geometry."""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'biomechanics'))
from engine import ModelEngine

out = ROOT / 'public/models/deltoid'
asset = json.loads((out / 'demo.json').read_text())
raw = json.loads((out / 'atlas.json').read_text())
assert asset['schema'] == 2
assert hashlib.sha256((out / 'atlas.json').read_bytes()).hexdigest() == asset['sourceHashes']['atlas.json']
assert hashlib.sha256((ROOT / 'public/models/body.glb').read_bytes()).hexdigest() == asset['atlasGLBSha256']
for p in asset['parts']:
    original = next(m for m in raw['meshes'] if m['name'] == p['name'])
    assert np.array_equal(np.array(p['atlasVertices']).ravel(), original['positions'])
    assert p['indices'] == original['indices']
assert len(asset['atlasBones']) == 3
for bone in asset['atlasBones']:
    assert bone == next(m for m in raw['meshes'] if m['name'] == bone['name'])
engine = ModelEngine('shoulder')
max_length_error = max_path_error = max_transform_error = max_polyline_error = 0
comparisons = 0
for f in reversed(asset['frames']):
    assert 'surfaces' not in f
    pose = engine.evaluate({'coordinates': {'shoulder_elv': f['angle']}})
    assert f['pose']['coordinates'] == pose['coordinates']
    for frame, matrix in f['pose']['transforms'].items():
        max_transform_error = max(max_transform_error, float(np.max(np.abs(np.array(matrix) - pose['transforms'][frame]))))
    assert len(f['pose']['muscles']) == 3
    for m in f['pose']['muscles']:
        native = next(n for n in pose['muscles'] if n['id'] == m['id'])
        assert m['available'] and native['available']
        max_length_error = max(max_length_error, abs(m['length'] - native['length']))
        max_path_error = max(max_path_error, float(np.max(np.abs(np.array(m['path']) - native['path']))))
        polyline = np.linalg.norm(np.diff(m['path'], axis=0), axis=1).sum()
        max_polyline_error = max(max_polyline_error, abs(float(polyline)-m['length']))
        comparisons += 1
assert max_length_error < 1e-8 and max_path_error < 1e-8 and max_transform_error < 1e-8
assert max_polyline_error < .001
report = dict(poses=len(asset['frames']), nativeCompartmentComparisons=comparisons,
              maxLengthErrorMm=max_length_error*1000, maxPathCoordinateErrorMm=max_path_error*1000,
              maxTransformComponentError=max_transform_error, maxPolylineVsNativeLengthMm=max_polyline_error*1000,
              unchangedAtlasRegions=3, unchangedAtlasBones=3,
              biologicalValidation=False, surfaceAnimation=False)
(ROOT / 'biomechanics/reports/deltoid-study-checks.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
