"""Bounded continuity probe; reports abrupt changes without claiming validation."""

from engine import ModelEngine, ROOT
import json, math

report = {}
for region in ("shoulder", "hip"):
    e = ModelEngine(region)
    sweeps = []
    for c in e.controls:
        previous = None
        jumps = []
        maxstep = (0, None, None)
        count = 0
        for angle in range(math.ceil(c["min"]), math.floor(c["max"]) + 1):
            pose = e.evaluate({"coordinates": {c["id"]: angle}})
            count += 1
            if previous:
                for a, b in zip(previous["muscles"], pose["muscles"]):
                    change = abs(a["length"] - b["length"]) * 1000
                    if change > maxstep[0]:
                        maxstep = (change, b["id"], angle)
                    if change > 5:
                        jumps.append(
                            {
                                "muscle": b["id"],
                                "endAngle": angle,
                                "changeMm": change,
                                "bothDrawingsAccepted": a["available"]
                                and b["available"],
                            }
                        )
            previous = pose
        sweeps.append(
            dict(
                coordinate=c["id"],
                poses=count,
                largestOneDegreeLengthChangeMm=maxstep[0],
                muscle=maxstep[1],
                endAngle=maxstep[2],
                stepsOver5mm=jumps,
            )
        )
    report[region] = sweeps
(ROOT / "reports" / "continuity.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
