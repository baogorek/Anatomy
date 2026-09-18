"""Full-body view of the pinned Bruno/Bern source, without changing its joints.

Slider signs are normalized for bilateral symmetry. All unexposed coordinates,
including locked wrists/forearms and welded scapulae, retain source defaults.
Limits are exploration limits, not clinical ranges. Outputs are path lengths.
"""
try:
    from .spine import NAMES as SPINE_NAMES, CONTROLS as SPINE_CONTROLS
except ImportError:
    from spine import NAMES as SPINE_NAMES, CONTROLS as SPINE_CONTROLS

ADAPTER = "wholebody-v1"
NAMES = dict(SPINE_NAMES)
LOWER_NAMES = {
    "bifemlh": "Biceps femoris · long head", "bifemsh": "Biceps femoris · short head",
    "sar": "Sartorius", "add_mag2": "Adductor magnus · compartment 2",
    "tfl": "Tensor fasciae latae", "pect": "Pectineus", "grac": "Gracilis",
    "iliacus": "Iliacus", "quad_fem": "Quadratus femoris", "gem": "Gemelli",
    "peri": "Piriformis", "rect_fem": "Rectus femoris", "vas_int": "Vastus intermedius",
    "med_gas": "Gastrocnemius · medial head", "soleus": "Soleus",
    "tib_post": "Tibialis posterior", "tib_ant": "Tibialis anterior",
}
for prefix, label in [("glut_med", "Gluteus medius"), ("glut_max", "Gluteus maximus")]:
    for i in range(1, 4):
        LOWER_NAMES[f"{prefix}{i}"] = f"{label} · compartment {i}"
for side, label in [("r", "Right"), ("l", "Left")]:
    NAMES.update({f"{name}_{side}": f"{label} {text}" for name, text in LOWER_NAMES.items()})

CONTROLS = []
GROUPS = []
def group(id, label, frame):
    GROUPS.append(dict(id=id, label=label, frame=f"/bodyset/{frame}"))
def control(id, label, detail, lo, hi, group, scale=1):
    CONTROLS.append(dict(id=id, axis="", label=label, detail=detail, min=lo, max=hi, group=group, scale=scale))

group("head", "Head & neck", "head_neck")
for axis, label, detail, limit in [
    ("FE", "Flexion / extension", "Positive = extension", 25),
    ("LB", "Side bending", "Positive = right", 15),
    ("AR", "Rotation", "Positive = left", 20),
]:
    control(f"T1_head_neck_{axis}", label, detail, -limit, limit, "head")

for side, label in [("r", "Right"), ("l", "Left")]:
    shoulder = f"shoulder_{side}"
    group(shoulder, f"{label} shoulder", f"humerus_{side.upper()}")
    control(f"shoulder_elv_{side}", "Abduction", "Positive = arm away from the side", 0, 90, shoulder, 1 if side == "r" else -1)
    control(f"elv_angle_{side}", "Flexion / extension", "Positive = arm forward; axes move with the arm", -25, 100, shoulder)
    control(f"shoulder_rot_{side}", "Internal / external rotation", "Positive = internal rotation", -40, 40, shoulder, 1 if side == "r" else -1)
    group(f"elbow_{side}", f"{label} elbow", f"ulna_{side.upper()}")
    control(f"elbow_flexion_{side}", "Flexion", "Bone motion only; this source has no elbow muscle paths", 0, 130, f"elbow_{side}")

for section, label in [("thoracic", "Thoracic spine"), ("lumbar", "Lumbar spine")]:
    group(section, label, "thoracic6" if section == "thoracic" else "lumbar3")
for c in SPINE_CONTROLS:
    CONTROLS.append({**c, "group": "thoracic" if c["level"].startswith("T") else "lumbar", "scale": 1})

for side, label in [("r", "Right"), ("l", "Left")]:
    hip = f"hip_{side}"
    group(hip, f"{label} hip", f"femur_{side}")
    control(f"hip_flexion_{side}", "Flexion / extension", "Positive = flexion", -20, 100, hip)
    control(f"hip_adduction_{side}", "Adduction / abduction", "Positive = toward midline", -30, 20, hip)
    control(f"hip_rotation_{side}", "Internal / external rotation", "Positive = internal rotation", -30, 30, hip)
    group(f"knee_{side}", f"{label} knee", f"tibia_{side}")
    control(f"knee_angle_{side}", "Flexion", "Positive = knee bends", 0, 120, f"knee_{side}", -1)
    group(f"ankle_{side}", f"{label} ankle", f"talus_{side}")
    control(f"ankle_angle_{side}", "Dorsiflexion / plantarflexion", "Positive = toes toward shin", -30, 20, f"ankle_{side}")
