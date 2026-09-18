"""Repeatable engineering checks. These do not establish biological validity."""

from engine import ModelEngine, ROOT, MANIFEST, VERSION, osim
import hashlib, json, math, random, statistics
from datetime import datetime, timezone
from runtime import verify_runtime

random.seed(73019)
native = verify_runtime()
report = {
    "created": datetime.now(timezone.utc).isoformat(),
    "engine": VERSION,
    "calculationBuild": native["id"],
    "scope": "Native numerical/geometry checks, not biological validation",
    "regions": {},
}
for region in ("shoulder", "hip"):
    e = ModelEngine(region)
    assert (
        hashlib.sha256((e.directory / "model.osim").read_bytes()).hexdigest()
        == MANIFEST[region]["sha256"]
    )
    requests = [{}]
    for c in e.controls:
        for value in [c["min"], (c["min"] + c["max"]) / 2, c["max"]]:
            requests.append({"coordinates": {c["id"]: value}})
    requests += [
        {
            "coordinates": {
                c["id"]: random.uniform(c["min"], c["max"]) for c in e.controls
            }
        }
        for _ in range(50)
    ]
    if region == "shoulder":
        requests += [
            {"track": key, "progress": p} for key in e.tracks for p in range(0, 101, 5)
        ]
    maximum_repeat = 0
    max_coordinate_error = 0
    max_fixed_error = 0
    max_path_error = 0
    withheld = {}
    latency = []
    native_comparisons = 0
    max_native_error = 0
    max_constraint_error = 0
    records = []
    # Independent API evaluation: a fresh model, not the browser adapter's cached state.
    raw = osim.Model(str(e.directory / "model.osim"))
    raw.initSystem()
    coords = {c.getName(): c for c in raw.getCoordinateSet()}
    for request in requests:
        p = e.evaluate(request)
        latency.append(p["elapsedMs"])
        for name, value in request.get("coordinates", {}).items():
            max_coordinate_error = max(
                max_coordinate_error, abs(p["coordinates"][name] - value)
            )
        if not request.get("track"):
            for name, value in e.default.items():
                if name not in {c["id"] for c in e.controls} and not e.coordinates[
                    name
                ].isDependent(e.state) and not (region == "shoulder" and name in ("clav_prot", "clav_elev", "scapula_winging")):
                    actual = p["coordinates"][name]
                    expected = (
                        math.degrees(value)
                        if e.coordinates[name].getMotionType() == 1
                        else value
                    )
                    max_fixed_error = max(max_fixed_error, abs(actual - expected))
        errors = e.state.getQErr()
        max_constraint_error = max(
            [max_constraint_error] + [abs(errors.get(i)) for i in range(errors.size())]
        )
        s = raw.initializeState()
        for name, value in p["coordinates"].items():
            coords[name].setValue(
                s,
                math.radians(value) if coords[name].getMotionType() == 1 else value,
                False,
            )
        raw.realizePosition(s)
        for m in p["muscles"]:
            direct = raw.getMuscles().get(m["id"]).getLength(s)
            max_native_error = max(max_native_error, abs(m["length"] - direct))
            native_comparisons += 1
            assert m["length"] > 0 and math.isfinite(m["length"])
            assert all(math.isfinite(x) for x in m["momentArms"].values())
            if not m["available"]:
                withheld[m["id"]] = withheld.get(m["id"], 0) + 1
                assert not m["path"]
            else:
                assert len(m["path"]) >= 2
                poly = sum(math.dist(a, b) for a, b in zip(m["path"], m["path"][1:]))
                max_path_error = max(max_path_error, abs(poly - m["length"]))
                assert abs(poly - m["length"]) <= 0.001
            # Each exposed frame must remain a rigid rotation (determinant +1).
        import numpy as np

        for matrix in p["transforms"].values():
            assert abs(np.linalg.det(np.array(matrix)[:, :3]) - 1) < 1e-10
        # Visit a different pose before returning, to detect history-dependent wrapping.
        e.evaluate({})
        again = e.evaluate(request)
        maximum_repeat = max(
            maximum_repeat,
            max(
                abs(a["length"] - b["length"])
                for a, b in zip(p["muscles"], again["muscles"])
            ),
        )
        records.append(
            {
                "request": request,
                "coordinates": p["coordinates"],
                "lengths": {m["id"]: m["length"] for m in p["muscles"]},
                "unavailable": [m["id"] for m in p["muscles"] if not m["available"]],
            }
        )
    assert maximum_repeat < 1e-9, maximum_repeat
    assert max_coordinate_error < 1e-6, max_coordinate_error
    assert max_fixed_error < 0.01, (
        max_fixed_error
    )  # Native assembly tolerances on unexposed, unlocked coordinates.
    assert max_native_error < 1e-6, max_native_error
    assert max_constraint_error < 1e-6, max_constraint_error
    # Action spot checks against native moment arms and length finite differences.
    checks = (
        [
            ("DeltoideusScapula_M", "shoulder_elv", 40, 1),
            ("PectoralisMajorThorax_I", "shoulder_elv", 40, -1),
        ]
        if region == "shoulder"
        else [
            ("bflh_r", "hip_flexion_r", 40, -1),
            ("psoas_r", "hip_flexion_r", 40, 1),
            ("recfem_r", "knee_angle_r", 40, -1),
            ("soleus_r", "ankle_angle_r", 10, -1),
            ("tibant_r", "ankle_angle_r", 10, 1),
            ("tibpost_r", "subtalar_angle_r", 10, 1),
            ("perlong_r", "subtalar_angle_r", 10, -1),
        ]
    )
    actions = []
    for muscle, coord, angle, expected_sign in checks:
        center = e.evaluate({"coordinates": {coord: angle}})
        a = e.evaluate({"coordinates": {coord: angle - 0.01}})
        b = e.evaluate({"coordinates": {coord: angle + 0.01}})
        pick = lambda p: next(m for m in p["muscles"] if m["id"] == muscle)
        moment = pick(center)["momentArms"][coord]
        fd = -(pick(b)["length"] - pick(a)["length"]) / math.radians(0.02)
        assert moment * expected_sign > 0, (muscle, moment)
        assert abs(moment - fd) < 0.001, (muscle, moment, fd)
        actions.append(
            dict(
                muscle=muscle,
                coordinate=coord,
                angle=angle,
                momentArmMm=moment * 1000,
                finiteDifferenceMm=fd * 1000,
            )
        )
    for invalid in [
        {"coordinates": {"unknown": 0}},
        {"coordinates": {e.controls[0]["id"]: 999}},
        {"coordinates": {e.controls[0]["id"]: float("nan")}},
        {"track": "missing"},
    ]:
        try:
            e.evaluate(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid input was accepted")
    result = dict(
        poses=len(requests),
        compartments=len(e.muscles),
        nativeLengthComparisons=native_comparisons,
        maxNativeDifferenceMm=max_native_error * 1000,
        maxRepeatDifferenceMm=maximum_repeat * 1000,
        maxCoordinateDifferenceDegrees=max_coordinate_error,
        maxFixedCoordinateDifference=max_fixed_error,
        maxConstraintResidual=max_constraint_error,
        maxAcceptedPolylineDifferenceMm=max_path_error * 1000,
        withheldDrawings=withheld,
        medianMs=statistics.median(latency),
        maxMs=max(latency),
        actionChecks=actions,
    )
    if region == "hip":
        # Functional ankle checks: movement direction, connected foot segments,
        # fixed toes, and a knee-dependent calf comparison used by the lesson.
        pick = lambda p, name: next(m for m in p["muscles"] if m["id"] == name)
        neutral = e.evaluate({})
        dorsiflexed = e.evaluate({"coordinates": {"ankle_angle_r": 20}})
        inverted = e.evaluate({"coordinates": {"subtalar_angle_r": 15}})
        assert dorsiflexed["transforms"]["/bodyset/talus_r"][1][0] > 0.3
        assert inverted["transforms"]["/bodyset/calcn_r"][2][1] > 0.2
        calf_poses = [
            e.evaluate({"coordinates": {"ankle_angle_r": 20, "knee_angle_r": k}})
            for k in [0, 90]
        ]
        changes = {}
        for name in ["gasmed_r", "gaslat_r", "soleus_r"]:
            a, b = [pick(p, name) for p in calf_poses]
            assert a["available"] and b["available"], name
            changes[name] = (b["length"] - a["length"]) * 1000
            if name == "soleus_r":
                assert abs(changes[name]) < 0.001
            else:
                assert changes[name] < -1
        assert (
            pick(dorsiflexed, "soleus_r")["length"]
            > pick(neutral, "soleus_r")["length"]
        )
        assert (
            pick(dorsiflexed, "tibant_r")["length"]
            < pick(neutral, "tibant_r")["length"]
        )
        for p in [neutral, dorsiflexed, inverted, *calf_poses]:
            assert abs(p["coordinates"]["mtp_angle_r"]) < 0.001
            for frame in ["talus_r", "calcn_r", "toes_r"]:
                assert "/bodyset/" + frame in p["transforms"]
        for name in ["ankle_angle_r", "subtalar_angle_r"]:
            c = next(c for c in e.controls if c["id"] == name)
            for value in [c["min"] - 0.5, c["max"] + 0.5, True, float("nan")]:
                try:
                    e.evaluate({"coordinates": {name: value}})
                except ValueError:
                    pass
                else:
                    raise AssertionError((name, value))
        result["ankleChecks"] = {
            "knee0To90AtAnkle20LengthChangeMm": changes,
            "startingPoseCalfDrawingErrorMm": {
                name: pick(neutral, name)["pathErrorMm"]
                for name in ["gasmed_r", "gaslat_r"]
            },
            "footTransformSignsAndFixedToes": "passed",
            "ankleAndSubtalarInputRejection": "passed",
        }
    report["regions"][region] = result
    (ROOT / "reports" / f"{region}-poses.json").write_text(
        json.dumps(records, indent=2) + "\n"
    )
    print(region, json.dumps(result, indent=2))
(ROOT / "reports" / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    "PASS: native agreement, repeatability, constraints, coordinate controls, accepted paths and selected action checks"
)
