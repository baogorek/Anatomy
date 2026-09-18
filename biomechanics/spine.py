"""Source-preserving, segment-by-segment thoracolumbar exploration.

Positive native FE is extension; LB right; AR left (verified against body
transforms in validate_spine.py). Limits are deliberately small exploration
limits, not clinical ranges. Non-spinal DOFs remain at source defaults.
"""
from pathlib import Path
import json

MUSCLES = json.loads((Path(__file__).parent / 'models/spine/muscles.json').read_text())
NAMES = {m['nativeId']: m['name'] for m in MUSCLES}
LEVELS = [f'T{i}_T{i+1}' for i in range(1, 12)] + ['T12_L1'] + [f'L{i}_L{i+1}' for i in range(1, 5)] + ['L5_S1']
DEFAULT_LEVEL = 'L3_L4'
CONTROLS = [
    dict(id=f'{level}_{axis}', axis='', label=label, detail=detail, min=lo, max=hi, level=level)
    for level in LEVELS
    for axis, label, detail, lo, hi in [
        ('FE', 'Flexion / extension', 'Negative = flexion; positive = extension at the selected joint', -3, 3),
        ('LB', 'Right / left lateral flexion', 'Positive = right side bending at the selected joint', -2, 2),
        ('AR', 'Left / right axial rotation', 'Positive = left rotation at the selected joint', -1, 1),
    ]
]
