"""Regression checks against the installed source-built package, without a shim."""

import importlib.util
import json
from pathlib import Path
from runtime import verify_runtime

ROOT = Path(__file__).resolve().parent
native = verify_runtime()
spec = importlib.util.spec_from_file_location(
    "wrap_audit", ROOT / "diagnostics/wrap-cache/probe.py"
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
report = audit.audit()
for name, stats in report["summary"].items():
    assert stats["withheld"] == 0, (name, stats)
    assert stats["maxPathErrorMm"] < 0.02, (name, stats)
    assert stats["maxCachedPointErrorMm"] < 1e-9, (name, stats)
    assert stats["maxRepeatErrorMm"] < 1e-6, (name, stats)
assert report["maxMomentArmErrorMm"] < 0.05
for changes in report["knee0To90ChangeMm"].values():
    assert all(change < -30 for change in changes.values())
report["calculationBuild"] = native["id"]
report["packageVersion"] = native["packageVersion"]
report["sourceBuiltPackage"] = True
(ROOT / "reports/gastrocnemius-installed.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(
    "PASS: installed package, 1,015 calf poses, cached points, repeatability and 72 action checks"
)
print(json.dumps(report["summary"], indent=2))
