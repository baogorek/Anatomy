"""Audit tibialis anterior transport and mechanics; anatomy evidence is separate.

The diagnostic origin perturbation affects an in-memory copy only. No source
model is changed. Numerical assertions do not constitute anatomical validation.
"""

import hashlib
import json
import math
import random
import xml.etree.ElementTree as ET

import opensim as osim

from engine import ModelEngine, ROOT, vec
from runtime import verify_runtime

native = verify_runtime()
engine = ModelEngine("hip")
model_file = ROOT / "models/hip/model.osim"
source_hash = hashlib.sha256(model_file.read_bytes()).hexdigest()
source = ET.parse(model_file).find('.//*[@name="tibant_r"]')
points = [
    dict(
        name=p.attrib["name"],
        frame=p.findtext("socket_parent_frame"),
        location=[float(v) for v in p.findtext("location").split()],
    )
    for p in source.findall(".//PathPoint")
]
upstream = json.loads((ROOT / "diagnostics/tibialis-anterior-source.json").read_text())
assert points == upstream["points"]
assert len(points) == 4 and not list(source.find(".//PathWrapSet/objects"))


def sample(coordinates):
    pose = engine.evaluate({"coordinates": coordinates})
    return next(m for m in pose["muscles"] if m["id"] == "tibant_r")


requests = [{"ankle_angle_r": a} for a in range(-40, 26)]
requests += [{"subtalar_angle_r": a} for a in range(-15, 21)]
requests += [
    {"ankle_angle_r": a, "subtalar_angle_r": s}
    for a in range(-40, 26, 5)
    for s in range(-15, 21, 5)
]
rng = random.Random(20260911)
requests += [
    {c["id"]: rng.uniform(c["min"], c["max"]) for c in engine.controls}
    for _ in range(100)
]
rows = []
max_endpoint_error = 0
for request in requests:
    result = sample(request)
    assert result["available"] and result["pathErrorMm"] < 1e-8
    assert len(result["path"]) == 4
    for expected, actual in zip(points, result["path"]):
        frame = engine.model.getBodySet().get(expected["frame"].split("/")[-1])
        world = vec(
            frame.findStationLocationInGround(
                engine.state, osim.Vec3(*expected["location"])
            )
        )
        max_endpoint_error = max(max_endpoint_error, math.dist(world, actual) * 1000)
    assert result["momentArms"]["ankle_angle_r"] > 0
    for coordinate in [
        "hip_flexion_r",
        "hip_rotation_r",
        "hip_adduction_r",
        "knee_angle_r",
    ]:
        assert abs(result["momentArms"][coordinate]) < 1e-8
    rows.append(
        dict(
            coordinates=request,
            lengthMm=result["length"] * 1000,
            ankleMomentArmMm=result["momentArms"]["ankle_angle_r"] * 1000,
            subtalarMomentArmMm=result["momentArms"]["subtalar_angle_r"] * 1000,
            pathErrorMm=result["pathErrorMm"],
        )
    )
assert max_endpoint_error < 1e-8

# Check signs and moment arms against length derivatives at interior sweep poses.
finite_differences = []
for coordinate, angles in [
    ("ankle_angle_r", range(-39, 25)),
    ("subtalar_angle_r", range(-14, 20)),
]:
    for angle in angles:
        center = sample({coordinate: angle})
        lo = sample({coordinate: angle - 0.01})["length"]
        hi = sample({coordinate: angle + 0.01})["length"]
        fd = -(hi - lo) / (2 * math.radians(0.01)) * 1000
        actual = center["momentArms"][coordinate] * 1000
        finite_differences.append(
            dict(
                coordinate=coordinate,
                angle=angle,
                nativeMm=actual,
                finiteDifferenceMm=fd,
                errorMm=abs(actual - fd),
            )
        )
assert max(r["errorMm"] for r in finite_differences) < 0.001


# Moving P1 on the tibia changes a constant segment length, not ankle leverage.
def direct(shift):
    model = osim.Model(str(model_file))
    muscle = model.updMuscles().get("tibant_r")
    if shift:
        point = osim.PathPoint.safeDownCast(
            muscle.updGeometryPath().updPathPointSet().get(0)
        )
        location = list(points[0]["location"])
        location[1] += shift
        point.set_location(osim.Vec3(*location))
    state = model.initSystem()
    result = []
    for angle in [-40, -20, 0, 20, 25]:
        state = model.initializeState()
        coordinate = model.updCoordinateSet().get("ankle_angle_r")
        coordinate.setValue(state, math.radians(angle), False)
        model.assemble(state)
        model.realizePosition(state)
        result.append(
            dict(
                angle=angle,
                lengthMm=muscle.getLength(state) * 1000,
                momentArmMm=muscle.computeMomentArm(state, coordinate) * 1000,
            )
        )
    return result


original, shifted = direct(0), direct(0.1)
offsets = [b["lengthMm"] - a["lengthMm"] for a, b in zip(original, shifted)]
arm_changes = [
    abs(b["momentArmMm"] - a["momentArmMm"]) for a, b in zip(original, shifted)
]
assert max(offsets) - min(offsets) < 1e-8 and max(arm_changes) < 1e-8
assert hashlib.sha256(model_file.read_bytes()).hexdigest() == source_hash

report = dict(
    scope="Tibialis anterior model audit, not whole-app or patient-specific anatomical validation",
    modelVersion=source_hash,
    calculationBuild=native["id"],
    points=points,
    upstreamPointDefinitionsMatch=True,
    upstream=upstream,
    poses=len(rows),
    maxEndpointTransportErrorMm=max_endpoint_error,
    maxPolylineErrorMm=max(r["pathErrorMm"] for r in rows),
    dorsiflexionActionAllSampledPoses=True,
    hipAndKneeMomentArmsZero=True,
    finiteDifferenceChecks=len(finite_differences),
    maxFiniteDifferenceErrorMm=max(r["errorMm"] for r in finite_differences),
    originShiftDiagnostic=dict(
        shiftMm=100,
        lengthOffsetsMm=offsets,
        maxMomentArmChangeMm=max(arm_changes),
        shipped=False,
    ),
    sagittalSweep=rows[:66],
    subtalarSweep=rows[66:102],
    samples=rows,
    finiteDifferences=finite_differences,
    anatomicalEndpointRegistrationValidated=False,
    experimentalMomentArmCurveFitValidated=False,
    limitations=[
        "Endpoint dots do not map anatomical attachment areas.",
        "Generic subtalar predictions do not establish universal inversion action; see Lee and Piazza (2008).",
        "Exact lengths and moment arms are model outputs, not measurements of the atlas or learner.",
    ],
)
(ROOT / "reports/tibialis-anterior-audit.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(
    json.dumps(
        {
            k: v
            for k, v in report.items()
            if k
            not in [
                "samples",
                "sagittalSweep",
                "subtalarSweep",
                "finiteDifferences",
                "upstream",
                "points",
            ]
        },
        indent=2,
    )
)
