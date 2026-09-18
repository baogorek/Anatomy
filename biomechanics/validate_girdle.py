"""Audit the recorded shoulder-girdle workspace; no new joint freedoms."""
from datetime import datetime, timezone
import hashlib
import json
import math
import numpy as np
from engine import ModelEngine, MANIFEST, ROOT, osim
from runtime import verify_runtime

native = verify_runtime()
e = ModelEngine('shoulder')
assert hashlib.sha256((e.directory / 'model.osim').read_bytes()).hexdigest() == MANIFEST['shoulder']['sha256']
girdle = {n for n in e.coordinates if n.startswith(('scapula_', 'clav_'))}
muscles = {m.getName() for m in e.muscles if m.getName().startswith(('Trapezius', 'Serratus', 'Rhomboideus', 'Levator')) or m.getName() == 'PectoralisMinor'}
assert len(girdle) == 6 and len(muscles) == 11
raw = osim.Model(str(e.directory / 'model.osim'))
raw.initSystem()
coords = {c.getName(): c for c in raw.getCoordinateSet()}
report = {
    'created': datetime.now(timezone.utc).isoformat(),
    'scope': 'All 101 integer playback positions in each supplied recording; native numerical checks, not individual anatomical validation. Recorded-track checks only; independent manual controls have a separate audit. No girdle moment-arm claims.',
    'modelVersion': e.model_version,
    'calculationVersion': e.calculation_version,
    'calculationBuild': native['id'],
    'poses': 0, 'independentLengthChecks': 0,
    'maxNativeLengthErrorMm': 0, 'maxDrawingErrorMm': 0,
    'maxConstraintResidual': 0, 'maxRepeatLengthErrorMm': 0,
    'maxLocalGirdleLengthChangeMm': 0,
    'withheld': {}, 'localNonGirdleJumps': [], 'tracks': {},
}
for track in e.tracks:
    ranges = {n: [float('inf'), -float('inf')] for n in girdle | {'shoulder_elv'}}
    for progress in range(101):
        request = {'track': track, 'progress': progress}
        p = e.evaluate(request)
        report['poses'] += 1
        qerr = e.state.getQErr()
        report['maxConstraintResidual'] = max([report['maxConstraintResidual']] + [abs(qerr.get(i)) for i in range(qerr.size())])
        for n in ranges:
            assert e.coordinates[n].getMotionType() == 1
            assert abs(math.radians(p['coordinates'][n]) - e.coordinates[n].getValue(e.state)) < 1e-10
            ranges[n][0] = min(ranges[n][0], p['coordinates'][n])
            ranges[n][1] = max(ranges[n][1], p['coordinates'][n])
        s = raw.initializeState()
        for n, v in p['coordinates'].items():
            coords[n].setValue(s, math.radians(v) if coords[n].getMotionType() == 1 else v, False)
        raw.realizePosition(s)
        for m in p['muscles']:
            length = raw.getMuscles().get(m['id']).getLength(s)
            report['independentLengthChecks'] += 1
            report['maxNativeLengthErrorMm'] = max(report['maxNativeLengthErrorMm'], abs(length - m['length']) * 1000)
            assert math.isfinite(length) and length > 0
            if m['available']:
                error = abs(sum(math.dist(a, b) for a, b in zip(m['path'], m['path'][1:])) - length) * 1000
                report['maxDrawingErrorMm'] = max(report['maxDrawingErrorMm'], error)
                assert error <= 1
            else:
                assert not m['path']
                report['withheld'][m['id']] = report['withheld'].get(m['id'], 0) + 1
                assert m['id'] not in muscles
        for t in p['transforms'].values():
            rot = np.array(t)[:, :3]
            assert np.max(abs(rot.T @ rot - np.eye(3))) < 1e-10
            assert abs(np.linalg.det(rot) - 1) < 1e-10
        # A local probe follows the recording, not an invented independent angle.
        lo, hi = [e.evaluate({'track': track, 'progress': v}) for v in (max(0, progress - .01), min(100, progress + .01))]
        for a, b in zip(lo['muscles'], hi['muscles']):
            change = abs(a['length'] - b['length']) * 1000
            if a['id'] in muscles:
                report['maxLocalGirdleLengthChangeMm'] = max(report['maxLocalGirdleLengthChangeMm'], change)
                assert change < 2, (track, progress, a['id'], change)
            elif change >= 2:
                report['localNonGirdleJumps'].append(dict(track=track, progress=progress, muscle=a['id'], changeMm=change))
        again = e.evaluate(request)
        report['maxRepeatLengthErrorMm'] = max(report['maxRepeatLengthErrorMm'], max(abs(a['length'] - b['length']) * 1000 for a, b in zip(p['muscles'], again['muscles'])))
    report['tracks'][track] = {'assembledAngleRangesDegrees': ranges}

# Quantify why simply exposing the six coordinate names as sliders is misleading.
report['naiveTenDegreeProbes'] = {}
for name in sorted(girdle):
    s = e.model.initializeState()
    for n, v in e.default.items():
        e.coordinates[n].setValue(s, v + (math.radians(10) if n == name else 0), False)
    e.model.assemble(s)
    report['naiveTenDegreeProbes'][name] = {n: math.degrees(e.coordinates[n].getValue(s) - e.default[n]) for n in sorted(girdle)}

report['predictions'] = []
for track, progress, name, expected in [
    ('SHRUG01', 25, 'LevatorScapulae', 'Shorter'),
    ('SHRUG01', 25, 'TrapeziusScapula_I', 'Longer'),
    ('ABD01', 50, 'SerratusAnterior_M', 'Shorter'),
    ('FLX01', 25, 'Rhomboideus_I', 'Longer'),
]:
    p = e.evaluate(dict(track=track, progress=progress))
    a = next(m for m in e.baseline['muscles'] if m['id'] == name)
    b = next(m for m in p['muscles'] if m['id'] == name)
    delta = (b['length'] - a['length']) * 1000
    assert a['available'] and b['available']
    actual = 'Shorter' if delta < -1 else 'Longer' if delta > 1 else 'Little change'
    assert actual == expected
    report['predictions'].append(dict(track=track, progress=progress, muscle=name, expected=expected, deltaMm=delta))
assert report['maxNativeLengthErrorMm'] < .001
assert report['maxConstraintResidual'] < 1e-8
assert report['maxRepeatLengthErrorMm'] < .001
(ROOT / 'reports/girdle-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
