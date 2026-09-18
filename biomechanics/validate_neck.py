"""Native neck geometry audit. Engineering consistency is not human validation."""

import hashlib, json, math, random, statistics
from collections import Counter
from datetime import datetime, timezone
from engine import ModelEngine, ROOT, MANIFEST, osim
from runtime import verify_runtime
from verify_assets import verify

engine = ModelEngine("neck")
native = verify_runtime()
assets = verify()
assert (
    hashlib.sha256((engine.directory / "model.osim").read_bytes()).hexdigest()
    == MANIFEST["neck"]["sha256"]
)
raw = osim.Model(str(engine.directory / "model.osim"))
raw.initSystem()
coordinates = {c.getName(): c for c in raw.getCoordinateSet()}


def raw_pose(values):
    s = raw.initializeState()
    for n, v in values.items():
        coordinates[n].setValue(
            s, math.radians(v) if n in engine.angular_coordinates else v, False
        )
    raw.assemble(s)
    raw.realizePosition(s)
    return {m.getName(): m.getLength(s) for m in raw.getMuscles()}


rng = random.Random(20260912)
requests = [
    {c["id"]: v} for c in engine.controls for v in range(c["min"], c["max"] + 1)
]
requests += [
    {c["id"]: rng.uniform(c["min"], c["max"]) for c in engine.controls}
    for _ in range(150)
]
max_native = 0
max_repeat = 0
max_coordinate = 0
max_fixed = 0
max_constraint = 0
max_path = {}
withheld = Counter()
actions = Counter()
fd = []
latency = []
bad = []
for i, request in enumerate(requests):
    p = engine.evaluate({"coordinates": request})
    latency.append(p["elapsedMs"])
    expected = raw_pose(p["coordinates"])
    for n, v in request.items():
        max_coordinate = max(max_coordinate, abs(p["coordinates"][n] - v))
    for n in ["gndpitch", "gndroll", "gndyaw", "spine_tx", "spine_ty", "spine_tz"]:
        value = (
            math.degrees(engine.default[n])
            if n in engine.angular_coordinates
            else engine.default[n]
        )
        max_fixed = max(max_fixed, abs(p["coordinates"][n] - value))
    err = engine.state.getQErr()
    max_constraint = max(
        [max_constraint] + [abs(err.get(i)) for i in range(err.size())]
    )
    samples = {m["id"]: m for m in p["muscles"]}
    for mid, m in samples.items():
        max_native = max(max_native, abs(m["length"] - expected[mid]) * 1000)
        max_path[mid] = max(max_path.get(mid, 0), m["pathErrorMm"])
        assert m["available"] == bool(m["path"])
        if m["available"]:
            assert m["pathErrorMm"] <= 1
        else:
            withheld[mid] += 1
            assert m["unavailableReason"]
            bad.append(dict(pose=request, muscle=mid, reason=m["unavailableReason"]))
        for n, ok in m["momentArmAvailable"].items():
            if ok:
                assert m["momentArmErrorMm"][n] <= 0.5 and m["available"]
            else:
                actions[f"{mid}:{n}"] += 1
    if i % 30 == 10:
        for c in engine.controls:
            n = c["id"]
            v = p["coordinates"][n]
            h = 0.01
            if not c["min"] + h < v < c["max"] - h:
                continue
            lo = raw_pose({**p["coordinates"], n: v - h})
            hi = raw_pose({**p["coordinates"], n: v + h})
            for mid, m in samples.items():
                error = (
                    abs(
                        -(hi[mid] - lo[mid]) / (2 * math.radians(h))
                        - m["momentArms"][n]
                    )
                    * 1000
                )
                fd.append(
                    dict(
                        muscle=mid,
                        coordinate=n,
                        errorMm=error,
                        actionAvailable=m["momentArmAvailable"][n],
                    )
                )
                if m["momentArmAvailable"][n]:
                    assert error <= 0.51, (
                        request,
                        mid,
                        n,
                        error,
                        m["momentArmErrorMm"][n],
                    )
        again = engine.evaluate({"coordinates": request})
        max_repeat = max(
            max_repeat,
            max(
                abs(a["length"] - b["length"]) * 1000
                for a, b in zip(p["muscles"], again["muscles"])
            ),
        )
assert (
    max_native < 0.01
    and max_repeat < 0.01
    and max_coordinate < 0.001
    and max_fixed < 0.001
    and max_constraint < 1e-5
), (max_native, max_repeat, max_coordinate, max_fixed, max_constraint)


def evaluate(values):
    return engine.evaluate({"coordinates": values})


def samples(p):
    return {m["id"]: m for m in p["muscles"]}


base = samples(evaluate({}))
predictions = []
for mid, values, sign in [
    ("stern_mast", {"yaw1": 20, "yaw2": 10}, -1),
    ("stern_mast_L", {"yaw1": 20, "yaw2": 10}, 1),
    ("scalenus_ant", {"roll2": 15, "roll1": 3}, -1),
    ("scalenus_ant_L", {"roll2": 15, "roll1": 3}, 1),
    ("long_cap_sklc4", {"pitch1": -12}, -1),
    ("scalenus_ant", {"pitch1": -12}, 0),
]:
    m = samples(evaluate(values))[mid]
    delta = (m["length"] - base[mid]["length"]) * 1000
    assert m["available"] and base[mid]["available"]
    assert abs(delta) < 1 if sign == 0 else delta * sign > 1, (mid, delta)
    predictions.append(dict(muscle=mid, coordinates=values, deltaMm=delta))
# Independent anatomical orientation checks: OpenSim X anterior, Y superior,
# Z right. Check the skull's forward/up axes, not slider labels.
for values, axis, component, sign in [
    ({"yaw1": 20, "yaw2": 10}, 0, 2, -1),
    ({"roll2": 15, "roll1": 3}, 1, 2, 1),
    ({"pitch1": -12}, 0, 1, -1),
    ({"pitch2": 20}, 0, 1, 1),
]:
    p = evaluate(values)
    assert p["transforms"]["/bodyset/skull"][component][axis] * sign > 0.1
# Bilateral SCM/scalene lengths and mirrored rotations/tilts should agree.
max_symmetry = 0
for values in [{}, {"yaw1": 20, "yaw2": 10}, {"roll2": 15, "roll1": 3}]:
    right = samples(evaluate(values))
    left = samples(evaluate({k: -v for k, v in values.items()}))
    for mid in [
        "stern_mast",
        "cleid_mast",
        "cleid_occ",
        "scalenus_ant",
        "scalenus_med",
        "scalenus_post",
    ]:
        max_symmetry = max(
            max_symmetry, abs(right[mid]["length"] - left[mid + "_L"]["length"]) * 1000
        )
assert max_symmetry < 0.01, max_symmetry
# Source point/body identities: all three SCM paths reach the skull, all
# scalene paths join the rib cage to cervical vertebrae (no skull endpoint).
attachments = {}
for mid in [
    "stern_mast",
    "cleid_mast",
    "cleid_occ",
    "scalenus_ant",
    "scalenus_med",
    "scalenus_post",
]:
    m = engine.model.getMuscles().get(mid)
    points = m.getGeometryPath().getPathPointSet()
    frames = [points.get(i).getParentFrame().getName() for i in range(points.getSize())]
    attachments[mid] = frames
    if mid.startswith("scalenus"):
        assert "ribcage" in frames and "skull" not in frames
    else:
        assert "skull" in frames
report = dict(
    created=datetime.now(timezone.utc).isoformat(),
    scope="Native cervical geometry and consistency; not individual movement, force, breathing or clinical validation",
    modelVersion=engine.model_version,
    calculationBuild=native["id"],
    assets=assets,
    poses=len(requests),
    musclePaths=len(engine.muscles),
    independentLengthComparisons=len(requests) * len(engine.muscles),
    maxNativeLengthErrorMm=max_native,
    maxRepeatErrorMm=max_repeat,
    maxCoordinateErrorDegrees=max_coordinate,
    maxFixedCoordinateError=max_fixed,
    maxConstraintError=max_constraint,
    maxPathErrorMm=max_path,
    withheldPaths=dict(withheld),
    withheldActions=dict(actions),
    finiteDifferenceChecks=len(fd),
    maxAcceptedMomentArmErrorMm=max(x["errorMm"] for x in fd if x["actionAvailable"]),
    maxBilateralSymmetryErrorMm=max_symmetry,
    medianEvaluationMs=statistics.median(latency),
    predictions=predictions,
    sourceAttachmentFrames=attachments,
    posesWithUnavailablePaths=bad,
)
(ROOT / "reports/neck-audit.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            k: v
            for k, v in report.items()
            if k
            not in ["maxPathErrorMm", "withheldActions", "posesWithUnavailablePaths"]
        },
        indent=2,
    )
)
