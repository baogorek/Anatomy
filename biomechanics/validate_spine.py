"""Independent source-model checks for every exposed spinal coordinate."""
import json, math, random, time
from pathlib import Path
import opensim as osim
try:
    from .engine import ModelEngine
    from .spine import LEVELS, DEFAULT_LEVEL, NAMES
except ImportError:
    from engine import ModelEngine
    from spine import LEVELS, DEFAULT_LEVEL, NAMES

osim.Logger.setLevelString('error')
root=Path(__file__).parent
engine=ModelEngine('spine')
independent=osim.Model(str(root/'models/spine/model.osim'))
state=independent.initSystem()
coords={c.getName():c for c in independent.getCoordinateSet()}
defaults={n:c.getValue(state) for n,c in coords.items()}
muscles={m.getName():m for m in independent.getMuscles() if m.getName() in NAMES}
requests=[{}]
for c in engine.controls:
    for angle in [c['min'],c['max']]:
        requests.append(dict(spineLevel=c['level'],coordinates={c['id']:angle}))
rng=random.Random(20260914)
# All 51 coordinates together: combined regional motion and corner conditions.
for i in range(60):
    requests.append(dict(spineLevel=LEVELS[i%17],coordinates={c['id']:rng.uniform(c['min'],c['max']) for c in engine.controls}))
requests += [dict(coordinates={c['id']:c['min'] for c in engine.controls}),dict(coordinates={c['id']:c['max'] for c in engine.controls})]
max_draw=max_length_error=max_angle_error=0.; fd_checks=0;unavailable=[];moment_withheld=set();count=0;start=time.perf_counter()
for i,request in enumerate(requests):
    pose=engine.evaluate(request)
    state=independent.initializeState()
    inputs = {n: math.radians(v) for n, v in request.get('coordinates', {}).items()}
    for n,c in coords.items():
        c.setValue(state, inputs.get(n, defaults[n]), False)
    independent.assemble(state);independent.realizePosition(state)
    for c in engine.controls:
        max_angle_error=max(max_angle_error,abs(pose['coordinates'][c['id']]-request.get('coordinates',{}).get(c['id'],c['default'])))
    for m in pose['muscles']:
        native=muscles[m['id'].removeprefix('spine__')].getLength(state)
        error=abs(native-m['length'])*1000
        max_length_error=max(max_length_error,error);assert error<1e-7,(i,m['id'],error)
        max_draw=max(max_draw,m['pathErrorMm']);count+=1
        if not m['available']:unavailable.append([i,m['id'],m['unavailableReason']]);assert not m['path']
        else:assert m['pathErrorMm']<=1
        for name,ok in m['momentArmAvailable'].items():
            if not ok:moment_withheld.add((m['id'],name))
    for name, c in coords.items():
        expected = inputs.get(name, defaults[name])
        actual = math.radians(pose['coordinates'][name]) if name in engine.angular_coordinates else pose['coordinates'][name]
        assert abs(actual-expected)<1e-10, (name, actual, expected)
    # Separate model and finite differences verify the runtime action gate.
    if i % 17 == 0:
        samples = {m['id'].removeprefix('spine__'): m for m in pose['muscles']}
        for control in engine.controls:
            if control['level'] != request.get('spineLevel', DEFAULT_LEVEL):
                continue
            name = control['id']
            # initializeState returns the model working state; preceding probes
            # may have changed it. Restore the target before each new axis.
            state = independent.initializeState()
            for n,c in coords.items():
                c.setValue(state, inputs.get(n, defaults[n]), False)
            independent.realizePosition(state)
            native_moments = {mid: m.computeMomentArm(state, coords[name]) for mid, m in muscles.items()}
            angle = pose['coordinates'][name]
            lo, hi = max(control['min'], angle-.01), min(control['max'], angle+.01)
            lengths = []
            for offset in [lo, hi]:
                probe = independent.initializeState()
                for n,c in coords.items():
                    c.setValue(probe, math.radians(offset) if n == name else inputs.get(n, defaults[n]), False)
                independent.realizePosition(probe)
                lengths.append({mid: m.getLength(probe) for mid,m in muscles.items()})
            for mid, sample in samples.items():
                derivative = -(lengths[1][mid]-lengths[0][mid])/math.radians(hi-lo)
                native = native_moments[mid]
                assert abs(native-sample['momentArms'][name]) < 1e-10, (i, mid, name, native, sample['momentArms'][name])
                expected_error = abs(derivative-native)*1000
                assert abs(expected_error-sample['momentArmErrorMm'][name]) < 1e-6
                assert sample['momentArmAvailable'][name] == (expected_error <= .5 and sample['available'])
                fd_checks += 1
    if i%20==0: print(f'{i+1}/{len(requests)} poses checked',flush=True)
assert max_angle_error<1e-7
# Input/order independence for native wrapping.
r=requests[50];first=engine.evaluate(r);engine.evaluate(requests[-1]);again=engine.evaluate(r)
repeat=max(abs(a['length']-b['length']) for a,b in zip(first['muscles'],again['muscles']));assert repeat<1e-12
# Signs from actual native transforms, not variable-name interpretation.
for axis,component,sign in [('FE',0,-1),('LB',2,1),('AR',2,-1)]:
    points=[]
    for value in [0,1]:
        state=independent.initializeState();coords['L3_L4_'+axis].setValue(state,math.radians(value),False);independent.realizePosition(state)
        station=osim.Vec3(.03,0,0) if axis=='AR' else osim.Vec3(0,.03,0)
        points.append(independent.getBodySet().get('lumbar3').findStationLocationInGround(state,station).get(component))
    assert (points[1]-points[0])*sign>0,(axis,points)
# Exercise predictions have a robust margin beyond the display deadband.
baseline={m['id']:m['length'] for m in engine.baseline['muscles']}
checks=[]
for angle,mid,sign in [(-3,'MF_m1s_r',1),(-3,'rect_abd_r',-1),(3,'MF_m1s_r',-1),(-3,'multifidus_T8_T6',0)]:
    p=engine.evaluate({'coordinates':{'L3_L4_FE':angle}});mid='spine__'+mid;m=next(m for m in p['muscles'] if m['id']==mid);delta=m['length']-baseline[mid];assert m['available'];assert abs(delta)<1e-10 if sign==0 else delta*sign>.001
    checks.append(dict(id=mid,angle=angle,deltaMm=delta*1000))
report=dict(modelVersion=engine.model_version,calculationVersion=engine.calculation_version,poses=len(requests),muscles=len(muscles),lengthChecks=count,independentMomentArmChecks=fd_checks,maxIndependentLengthErrorMm=max_length_error,maxDrawingErrorMm=max_draw,maxCoordinateErrorDegrees=max_angle_error,repeatErrorMetres=repeat,unavailable=unavailable,momentArmWithheld=sorted(moment_withheld),quizChecks=checks,elapsedSeconds=round(time.perf_counter()-start,1),limitations='Numerical consistency, not anatomical validation of every source attachment. Non-spinal DOFs including abdominal routing are fixed. No physiological range, cartilage, passive stiffness, activation, breathing or force prediction.')
(root/'reports/spine-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['unavailable','momentArmWithheld']},indent=2));print('Unavailable path samples:',len(unavailable),'withheld moment pairs:',len(moment_withheld))
