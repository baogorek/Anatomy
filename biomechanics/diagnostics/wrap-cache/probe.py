import json, math, random, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from biomechanics.engine import ModelEngine, vec, apply, VERSION


def audit():
    x = ModelEngine("hip")
    x.muscles = [m for m in x.muscles if m.getName() in ["gasmed_r", "gaslat_r"]]
    rng = random.Random(92741)
    poses = [
        {"knee_angle_r": k, "ankle_angle_r": a, "subtalar_angle_r": s}
        for k in range(0, 121, 2)
        for a in [-40, -20, 0, 20, 25]
        for s in [-15, 0, 20]
    ]
    poses += [
        {c["id"]: rng.uniform(c["min"], c["max"]) for c in x.controls}
        for _ in range(100)
    ]
    summary = {
        n: {
            "withheld": 0,
            "maxPathErrorMm": 0,
            "maxCachedPointErrorMm": 0,
            "maxRepeatErrorMm": 0,
        }
        for n in ["gasmed_r", "gaslat_r"]
    }
    for i, coords in enumerate(poses):
        p = x.evaluate({"coordinates": coords})
        for m, sample in zip(x.muscles, p["muscles"]):
            item = summary[sample["id"]]
            item["withheld"] += not sample["available"]
            item["maxPathErrorMm"] = max(item["maxPathErrorMm"], sample["pathErrorMm"])
            pts = m.getGeometryPath().getCurrentPath(x.state)
            for j in range(pts.getSize()):
                pt = pts.get(j)
                discrepancy = 1000 * math.dist(
                    vec(pt.getLocationInGround(x.state)),
                    vec(
                        apply(
                            pt.getParentFrame().getTransformInGround(x.state),
                            pt.getLocation(x.state),
                        )
                    ),
                )
                item["maxCachedPointErrorMm"] = max(
                    item["maxCachedPointErrorMm"], discrepancy
                )
        if i % 25 == 0:
            x.evaluate({})
            again = x.evaluate({"coordinates": coords})
            for a, b in zip(p["muscles"], again["muscles"]):
                summary[a["id"]]["maxRepeatErrorMm"] = max(
                    summary[a["id"]]["maxRepeatErrorMm"],
                    1000 * abs(a["length"] - b["length"]),
                )
    checks = []
    for knee in [1, 10, 30, 60, 90, 119]:
        for ankle in [-39, 0, 24]:
            coords = {"knee_angle_r": knee, "ankle_angle_r": ankle}
            p = x.evaluate({"coordinates": coords})
            for coordinate in coords:
                left = x.evaluate(
                    {"coordinates": {**coords, coordinate: coords[coordinate] - 0.01}}
                )
                right = x.evaluate(
                    {"coordinates": {**coords, coordinate: coords[coordinate] + 0.01}}
                )
                for center, a, b in zip(
                    p["muscles"], left["muscles"], right["muscles"]
                ):
                    fd = -(b["length"] - a["length"]) / math.radians(0.02)
                    ma = center["momentArms"][coordinate]
                    checks.append(
                        dict(
                            muscle=center["id"],
                            coordinates=coords,
                            axis=coordinate,
                            nativeMm=ma * 1000,
                            finiteDifferenceMm=fd * 1000,
                            errorMm=abs(ma - fd) * 1000,
                        )
                    )
    rest = x.evaluate({})
    calf = {}
    for ankle in [0, 20]:
        pair = [
            x.evaluate({"coordinates": {"knee_angle_r": k, "ankle_angle_r": ankle}})
            for k in [0, 90]
        ]
        calf[str(ankle)] = {
            a["id"]: (b["length"] - a["length"]) * 1000
            for a, b in zip(pair[0]["muscles"], pair[1]["muscles"])
        }
    return dict(
        engine=VERSION,
        poses=len(poses),
        summary=summary,
        rest={
            m["id"]: dict(lengthMm=m["length"] * 1000, pathErrorMm=m["pathErrorMm"])
            for m in rest["muscles"]
        },
        knee0To90ChangeMm=calf,
        momentArmChecks=checks,
        maxMomentArmErrorMm=max(c["errorMm"] for c in checks),
    )


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))
