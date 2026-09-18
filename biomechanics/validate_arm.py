"""Reproducible native arm audit; numerical checks are not human validation."""

import hashlib
import json
import math
import random
import statistics
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone

from engine import ModelEngine, ROOT, MANIFEST, osim
from runtime import verify_runtime
from verify_assets import verify

native = verify_runtime()
assets = verify()
engine = ModelEngine("arm")
original = ROOT / "models/arm/source.osim"
derived = ROOT / "models/arm/model.osim"
assert (
    hashlib.sha256(original.read_bytes()).hexdigest() == MANIFEST["arm"]["sourceSha256"]
)
assert hashlib.sha256(derived.read_bytes()).hexdigest() == MANIFEST["arm"]["sha256"]
# Prove the entire XML differs only in the two declared PathWrap ranges.
a, b = ET.parse(original), ET.parse(derived)
for node, limits in zip(
    a.findall('.//*[@name="ECRL"]/GeometryPath/PathWrapSet/objects/PathWrap/range'),
    ["1 2", "3 4"],
):
    node.text = limits
# XML whitespace inside each changed property is immaterial.
for tree in (a, b):
    for node in tree.iter():
        if node.text:
            node.text = node.text.strip()
        if node.tail:
            node.tail = node.tail.strip()
assert ET.tostring(a.getroot()) == ET.tostring(b.getroot())

raw = osim.Model(str(derived))
raw.initSystem()
coords = {c.getName(): c for c in raw.getCoordinateSet()}


def native_lengths(values, model=raw, coordinates=coords):
    state = model.initializeState()
    for n, v in values.items():
        coordinates[n].setValue(state, math.radians(v), False)
    model.assemble(state)
    model.realizePosition(state)
    return {m.getName(): m.getLength(state) for m in model.getMuscles()}


rng = random.Random(42)
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
max_path = {}
withheld = Counter()
action_withheld = Counter()
latency = []
rows = []
fd = []
for i, request in enumerate(requests):
    p = engine.evaluate({"coordinates": request})
    latency.append(p["elapsedMs"])
    expected = native_lengths(p["coordinates"])
    for n, v in request.items():
        max_coordinate = max(max_coordinate, abs(p["coordinates"][n] - v))
    for n in ["elv_angle", "shoulder_elv", "shoulder_rot"]:
        assert abs(p["coordinates"][n] - math.degrees(engine.default[n])) < 1e-4, (
            request,
            n,
            p["coordinates"][n],
            math.degrees(engine.default[n]),
        )
    samples = {m["id"]: m for m in p["muscles"]}
    for m in p["muscles"]:
        mid = m["id"]
        max_native = max(max_native, abs(m["length"] - expected[mid]) * 1000)
        max_path[mid] = max(max_path.get(mid, 0), m["pathErrorMm"])
        assert m["available"] == bool(m["path"])
        if m["available"]:
            assert m["pathErrorMm"] <= 1
        else:
            assert m["unavailableReason"]
            withheld[mid] += 1
        if mid == "SUP" and p["coordinates"]["pro_sup"] > 1e-6:
            assert not m["available"]
        for n, available in m["momentArmAvailable"].items():
            if available:
                assert m["momentArmErrorMm"][n] <= 0.5 and m["available"]
            else:
                action_withheld[f"{mid}:{n}"] += 1
    if i % 25 == 10:
        for c in engine.controls:
            n = c["id"]
            v = p["coordinates"][n]
            # Recreate the same degree-based probe in an independent model.
            h = 0.01
            if not c["min"] + h < v < c["max"] - h:
                continue
            lo = native_lengths({**p["coordinates"], n: v - h})
            hi = native_lengths({**p["coordinates"], n: v + h})
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
                        pose=request,
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
                abs(x["length"] - y["length"]) * 1000
                for x, y in zip(p["muscles"], again["muscles"])
            ),
        )
    rows.append(
        dict(
            coordinates=request,
            unavailable=[m["id"] for m in p["muscles"] if not m["available"]],
        )
    )
assert max_native < 0.01 and max_repeat < 0.01 and max_coordinate < 0.001, (
    max_native,
    max_repeat,
    max_coordinate,
)


# Teaching predictions are deliberately checked as finite changes, separately
# from native moment arms. Each must clear the UI's 1 mm deadband.
def sample(values):
    return {m["id"]: m for m in engine.evaluate({"coordinates": values})["muscles"]}


base = sample({})
cases = [
    ("BIClong", {"elbow_flexion": 90}, -1),
    ("TRIlong", {"elbow_flexion": 90}, 1),
    ("BRA", {"elbow_flexion": 90}, -1),
    ("PQ", {"pro_sup": -60}, 1),
    ("FCR", {"flexion": 40}, -1),
    ("ECRB", {"flexion": 40}, 1),
    ("FCU", {"deviation": 20}, -1),
    ("ECU", {"deviation": 20}, -1),
]
predictions = []
for mid, pose, sign in cases:
    m = sample(pose)[mid]
    delta = (m["length"] - base[mid]["length"]) * 1000
    assert m["available"] and base[mid]["available"] and delta * sign > 1
    predictions.append(dict(muscle=mid, coordinates=pose, deltaMm=delta))
# Isolate the ECRL regression in the preserved source and active derivative.
source_model = osim.Model(str(original))
source_model.initSystem()
source_coords = {c.getName(): c for c in source_model.getCoordinateSet()}
ecrl = []
for angle in range(-60, 61):
    active = sample({"flexion": angle})["ECRL"]
    source = native_lengths({"flexion": angle}, source_model, source_coords)["ECRL"]
    assert active["available"] and 0.25 < active["length"] < 0.4
    ecrl.append(
        dict(
            wristFlexion=angle, sourceMm=source * 1000, activeMm=active["length"] * 1000
        )
    )
assert max(abs(a["activeMm"] - b["activeMm"]) for a, b in zip(ecrl, ecrl[1:])) < 1
assert max(x["sourceMm"] for x in ecrl) > 800
report = dict(
    created=datetime.now(timezone.utc).isoformat(),
    scope="Native transport, routing and consistency checks; not individual anatomical or clinical validation",
    modelVersion=engine.model_version,
    calculationBuild=native["id"],
    assets=assets,
    poses=len(requests),
    independentLengthComparisons=len(requests) * 17,
    maxNativeLengthErrorMm=max_native,
    maxRepeatErrorMm=max_repeat,
    maxCoordinateErrorDegrees=max_coordinate,
    maxPathErrorMm=max_path,
    withheldPaths=dict(withheld),
    withheldActions=dict(action_withheld),
    finiteDifferenceChecks=len(fd),
    maxAcceptedMomentArmErrorMm=max(x["errorMm"] for x in fd if x["actionAvailable"]),
    largestNativeMomentArmDisagreements=sorted(fd, key=lambda x: -x["errorMm"])[:12],
    medianEvaluationMs=statistics.median(latency),
    predictions=predictions,
    ecrlCorrection=ecrl,
    posesWithUnavailablePaths=[r for r in rows if r["unavailable"]],
)
(ROOT / "reports/arm-audit.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            k: v
            for k, v in report.items()
            if k
            not in [
                "ecrlCorrection",
                "posesWithUnavailablePaths",
                "largestNativeMomentArmDisagreements",
                "withheldActions",
            ]
        },
        indent=2,
    )
)
