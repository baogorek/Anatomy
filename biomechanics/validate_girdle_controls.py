"""Independent checks of the constrained manual shoulder-girdle controls."""
from datetime import datetime, timezone
import itertools, json, math, random
import numpy as np
from engine import ModelEngine, ROOT, osim
from girdle import CONTROLS, INDEPENDENT, DEPENDENT

e = ModelEngine('shoulder')
raw = osim.Model(str(e.directory / 'model.osim')); raw.initSystem()
coords = {c.getName(): c for c in raw.getCoordinateSet()}
requests = [{}]
for c in CONTROLS:
    requests += [{'coordinates': {c['id']: v}} for v in range(c['min'], c['max'] + 1)]
requests += [{'coordinates': dict(zip(INDEPENDENT, values))} for values in itertools.product(*[(c['min'], c['max']) for c in CONTROLS])]
rng = random.Random(91723)
requests += [{'coordinates': {c['id']: rng.uniform(c['min'], c['max']) for c in e.controls}} for _ in range(180)]
report = dict(created=datetime.now(timezone.utc).isoformat(), modelVersion=e.model_version, calculationVersion=e.calculation_version,
              scope='Constrained manual controls; numerical and direction checks, not individual anatomical validation', poses=len(requests),
              independentLengthChecks=0, maxNativeErrorMm=0, maxRequestedAngleErrorDegrees=0, maxConstraintResidual=0,
              maxFixedCoordinateError=0, maxDrawingErrorMm=0, maxRepeatErrorMm=0, withheld={}, withheldGirdleActions=True, predictions=[])
for i, request in enumerate(requests):
    pose=e.evaluate(request)
    errors=e.state.getQErr()
    report['maxConstraintResidual']=max([report['maxConstraintResidual']]+[abs(errors.get(j)) for j in range(errors.size())])
    desired={**{c['id']:c['default'] for c in e.controls},**request.get('coordinates',{})}
    for n,v in desired.items():report['maxRequestedAngleErrorDegrees']=max(report['maxRequestedAngleErrorDegrees'],abs(pose['coordinates'][n]-v))
    for n,v in e.default.items():
        if n in desired or n in DEPENDENT:continue
        expected=math.degrees(v) if n in e.angular_coordinates else v
        report['maxFixedCoordinateError']=max(report['maxFixedCoordinateError'],abs(pose['coordinates'][n]-expected))
    state=raw.initializeState()
    for n,v in pose['coordinates'].items():coords[n].setValue(state,math.radians(v) if n in e.angular_coordinates else v,False)
    raw.realizePosition(state)
    for m in pose['muscles']:
        actual=raw.getMuscles().get(m['id']).getLength(state)
        report['independentLengthChecks']+=1
        report['maxNativeErrorMm']=max(report['maxNativeErrorMm'],abs(actual-m['length'])*1000)
        assert math.isfinite(actual) and actual>0
        if m['available']:
            error=abs(sum(math.dist(a,b) for a,b in zip(m['path'],m['path'][1:]))-actual)*1000
            report['maxDrawingErrorMm']=max(report['maxDrawingErrorMm'],error)
            assert error<=1
        else:
            assert not m['path'] and m['unavailableReason']
            report['withheld'][m['id']]=report['withheld'].get(m['id'],0)+1
        assert all(m['momentArmAvailable'][n] is False for n in INDEPENDENT)
    for t in pose['transforms'].values():
        rotation=np.array(t)[:,:3]
        assert np.max(abs(rotation.T@rotation-np.eye(3)))<1e-10
        assert abs(np.linalg.det(rotation)-1)<1e-10
    if i%10==0:
        e.evaluate({'coordinates':{'scapula_elevation':6,'scapula_upward_rot':35}})
        again=e.evaluate(request)
        report['maxRepeatErrorMm']=max(report['maxRepeatErrorMm'],max(abs(a['length']-b['length'])*1000 for a,b in zip(pose['muscles'],again['muscles'])))
# Native landmark directions: +X anterior, +Y superior, +Z right.
base=e.evaluate({})
origin=np.array(base['transforms']['/bodyset/scapula'])[:,3]
for n, axis in [('scapula_abduction',0),('scapula_elevation',1)]:
    p=e.evaluate({'coordinates':{n:base['coordinates'][n]+5}})
    assert p['transforms']['/bodyset/scapula'][axis][3]-origin[axis]>.003
# The actual mesh's inferior tip swings laterally relative to the glenoid
# as the right scapula rotates upward (+Z is the person's right).
mesh=next(m for m in e.meshes if m['name']=='scapula.vtp')
tip=np.array(min(mesh['vertices'],key=lambda p:p[1]))
up=e.evaluate({'coordinates':{'scapula_upward_rot':35}})
a=np.array(base['transforms'][mesh['frame']])[:,:3]@tip
b=np.array(up['transforms'][mesh['frame']])[:,:3]@tip
assert b[2]-a[2]>.03
report['inferiorTipLateralMotionRelativeToGlenoidMm']=float((b[2]-a[2])*1000)
for values,name,sign in [({'scapula_abduction':0},'SerratusAnterior_M',-1),({'scapula_abduction':0},'Rhomboideus_I',1),
                         ({'scapula_elevation':6},'LevatorScapulae',-1),({'scapula_elevation':6},'TrapeziusScapula_I',1),
                         ({'scapula_upward_rot':35},'SerratusAnterior_M',-1),({'scapula_upward_rot':35},'TrapeziusScapula_I',-1)]:
    p=e.evaluate({'coordinates':values})
    a=next(m for m in base['muscles'] if m['id']==name);b=next(m for m in p['muscles'] if m['id']==name)
    delta=(b['length']-a['length'])*1000
    assert a['available'] and b['available'] and sign*delta>1
    report['predictions'].append(dict(coordinates=values,muscle=name,deltaMm=delta))
for invalid in [{'scapula_abduction':6},{'scapula_elevation':-11},{'scapula_upward_rot':46},{'scapula_elevation':True},{'scapula_winging':0},{'clav_elev':0}]:
    try:e.evaluate({'coordinates':invalid})
    except ValueError:pass
    else:raise AssertionError(invalid)
assert report['maxRequestedAngleErrorDegrees']<1e-5
assert report['maxConstraintResidual']<1e-8
assert report['maxFixedCoordinateError']<1e-8
assert report['maxNativeErrorMm']<.001
assert report['maxRepeatErrorMm']<.001
(ROOT/'reports/girdle-controls-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
