"""Independent replay of whole-body controls against the unmodified pinned source."""
import json, math, random
from pathlib import Path
import opensim as osim
from engine import ModelEngine

root = Path(__file__).parent
engine = ModelEngine("wholebody")
native = osim.Model(str(root / "models/spine/model.osim"))
state = native.initSystem()
coordinates = {c.getName(): c for c in native.getCoordinateSet()}
defaults = {n: c.getValue(state) for n, c in coordinates.items()}
# Independent, explicit public-to-source sign convention.
negative = {"knee_angle_r", "knee_angle_l", "shoulder_elv_l", "shoulder_rot_l"}
def scale(n): return -1 if n in negative else 1
requests = [{}] + [{c["id"]: v} for c in engine.controls for v in (c["min"], c["max"])]
rng = random.Random(20260915)
requests += [{c["id"]: rng.uniform(c["min"], c["max"]) for c in engine.controls} for _ in range(24)]
requests += [{c["id"]: c[end] for c in engine.controls} for end in ("min", "max")]
max_length_error = max_path_error = 0
withheld = 0
for i, values in enumerate(requests):
    pose = engine.evaluate({"coordinates": values})
    state = native.initializeState()
    for n, c in coordinates.items():
        c.setValue(state, math.radians(values[n] * scale(n)) if n in values else defaults[n], False)
    native.assemble(state)
    native.realizePosition(state)
    for c in engine.controls:
        assert abs(pose["coordinates"][c["id"]] - values.get(c["id"], c["default"])) < 1e-9
    for n, c in coordinates.items():
        actual = pose["coordinates"][n]
        if n in engine.angular_coordinates: actual = math.radians(actual * scale(n))
        assert abs(actual - c.getValue(state)) < 1e-10, n
    for sample, muscle in zip(pose["muscles"], native.getMuscles()):
        assert sample["id"] == "wholebody__" + muscle.getName()
        error = abs(sample["length"] - muscle.getLength(state)) * 1000
        max_length_error = max(max_length_error, error)
        assert error < 1e-7
        max_path_error = max(max_path_error, sample["pathErrorMm"])
        if sample["available"]:
            assert sample["pathErrorMm"] <= 1
            assert abs(sum(math.dist(a, b) for a, b in zip(sample["path"], sample["path"][1:])) - sample["length"]) <= .001
        else:
            withheld += 1
            assert sample["path"] == []
        assert sample["momentArms"] == {}  # No joint-action claims in this workspace.
    for frame, t in pose["transforms"].items():
        expected = native.getComponent(frame).getTransformInGround(state)
        for row in range(3):
            assert abs(t[row][3] - expected.p().get(row)) < 1e-10
            for col in range(3): assert abs(t[row][col] - expected.R().get(row, col)) < 1e-10

def lengths(values):
    return {m["id"].removeprefix("wholebody__"): m["length"] for m in engine.evaluate({"coordinates": values})["muscles"]}
neutral = lengths({})
hip = lengths({"hip_flexion_r": 70})
knee = lengths({"hip_flexion_r": 70, "knee_angle_r": 60})
ankle = lengths({"hip_flexion_r": 70, "ankle_angle_r": 20})
assert hip["bifemlh_r"] > neutral["bifemlh_r"] + .01
assert knee["bifemlh_r"] < hip["bifemlh_r"] - .01
assert ankle["med_gas_r"] > hip["med_gas_r"] + .01
assert knee["med_gas_r"] < hip["med_gas_r"] - .01
assert abs(knee["soleus_r"] - hip["soleus_r"]) < 1e-12
for name in ("bifemlh_r", "bifemsh_r"):
    assert abs(ankle[name] - hip[name]) < 1e-12
for name in ("bifemlh_l", "med_gas_l", "soleus_l"):
    assert abs(ankle[name] - neutral[name]) < 1e-12
first = lengths(requests[-3]); lengths(requests[-1]); again = lengths(requests[-3])
assert max(abs(first[n] - again[n]) for n in first) < 1e-12

# Direction checks use landmarks in world coordinates (+X anterior, +Z right).
def station(body, local, values):
    state = native.initializeState()
    for n, c in coordinates.items():
        c.setValue(state, math.radians(values[n] * scale(n)) if n in values else defaults[n], False)
    native.assemble(state); native.realizePosition(state)
    p = native.getBodySet().get(body).getTransformInGround(state).shiftFrameStationToBase(osim.Vec3(*local))
    return [p[i] for i in range(3)]
for side, zsign in [("r", 1), ("l", -1)]:
    ulna = "ulna_" + side.upper()
    p = station(ulna, [0, 0, 0], {})
    assert (station(ulna, [0, 0, 0], {f"shoulder_elv_{side}": 20})[2] - p[2]) * zsign > .05
    assert station(ulna, [0, 0, 0], {f"elv_angle_{side}": 20})[0] > p[0] + .05
    foot = "calcn_" + side
    p = station(foot, [0, 0, 0], {})
    assert station(foot, [0, 0, 0], {f"hip_flexion_{side}": 20})[0] > p[0] + .1
    assert station(foot, [0, 0, 0], {f"knee_angle_{side}": 20})[0] < p[0] - .1
    assert station(foot, [.15, 0, 0], {f"ankle_angle_{side}": 20})[1] > station(foot, [.15, 0, 0], {})[1] + .02
for axis, component, sign in [("FE", 0, -1), ("LB", 2, 1), ("AR", 2, -1)]:
    local = [.1, 0, 0] if axis == "AR" else [0, .2, 0]
    before = station("head_neck", local, {})
    after = station("head_neck", local, {f"T1_head_neck_{axis}": 10})
    assert (after[component] - before[component]) * sign > .01

for values in [{"knee_angle_r": -1}, {"pro_sup_r": 5}, {"hip_flexion_r": True}, {"hip_flexion_r": float("nan")}, {"L3_L4_FE": 4}]:
    try: engine.evaluate({"coordinates": values})
    except ValueError: pass
    else: raise AssertionError(values)
assert len(engine.controls) == 72 and len(engine.muscles) == 598
assert len({m["id"] for m in engine.meshes}) == len(engine.meshes) == 130
assert {"/bodyset/head_neck", "/bodyset/hand_L", "/bodyset/hand_R", "/bodyset/calcn_l", "/bodyset/calcn_r"} <= set(engine.frames)
report = dict(sourceHash=engine.model_version, calculationVersion=engine.calculation_version,
    poses=len(requests), nativeLengthComparisons=len(requests)*598, maxNativeLengthErrorMm=max_length_error,
    maxDrawingErrorMm=max_path_error, withheldPaths=withheld, controls=72, musclePaths=598, meshes=130,
    combinedHipKneeAnkleChecks="passed", bilateralSigns="passed", headSigns="passed", repeatPose="passed",
    note="Software/source agreement checks, not biological validation of arbitrary combined poses.")
(root / "reports/wholebody-validation.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
