"""Export unchanged atlas anatomy alongside sampled native OpenSim mechanics.

No atlas-to-model registration, muscle surface deformation or interpolation.
Run from the repo root with .venv-opensim/bin/python.
"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'biomechanics'))
from engine import ModelEngine, VERSION, MANIFEST

OUT = ROOT / 'public/models/deltoid'
source = json.loads((OUT / 'atlas.json').read_text())
assert source['sourceSha256'] == hashlib.sha256((ROOT / 'public/models/body.glb').read_bytes()).hexdigest(), 'Re-extract the atlas from the current GLB.'
engine = ModelEngine('shoulder')
config = engine.config()
config['meshes'] = [m for m in config['meshes'] if m['name'] in
                    ['clavicle.vtp', 'scapula.vtp', 'humerus.vtp', 'thorax.vtp']]
ids = ['DeltoideusClavicle_A', 'DeltoideusScapula_M', 'DeltoideusScapula_P']
names = ['Clavicular Part Of Deltoid Muscle', 'Acromial Part Of Deltoid Muscle',
         'Scapular Spinal Part Of Deltoid Muscle']
parts = []
for id, name in zip(ids, names):
    mesh = next(m for m in source['meshes'] if m['name'] == name)
    parts.append(dict(id=id, name=name, indices=mesh['indices'],
                      atlasVertices=[mesh['positions'][i:i+3]
                                     for i in range(0, len(mesh['positions']), 3)]))
frames = []
for angle in range(20, 71, 2):
    pose = engine.evaluate({'coordinates': {'shoulder_elv': angle}})
    pose['muscles'] = [m for m in pose['muscles'] if m['id'] in ids]
    assert len(pose['muscles']) == 3 and all(m['available'] for m in pose['muscles'])
    frames.append(dict(angle=angle, pose=pose))
asset = dict(schema=2, modelVersion=config['version'], sourceModel=MANIFEST['shoulder'], config=config, parts=parts,
             atlasBones=[m for m in source['meshes'] if m['name'] in ['Clavicle', 'Scapula', 'Humerus']],
             frames=frames, license='See ATTRIBUTION.md; component licenses apply.',
             sourceHashes={name: hashlib.sha256((OUT / name).read_bytes()).hexdigest()
                           for name in ['atlas.json']},
             atlasGLBSha256=hashlib.sha256((ROOT / 'public/models/body.glb').read_bytes()).hexdigest(),
             opensimVersion=VERSION,
             scope='Unchanged resting atlas and separate native model bones/paths; no moving muscle surfaces.')
(OUT / 'demo.json').write_text(json.dumps(asset, separators=(',', ':')))
print(f'Exported {len(frames)} native poses and {len(parts)} unchanged atlas regions.')
