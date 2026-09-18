"""Native OpenSim pose evaluation. No mesh-derived lengths or learned surrogates."""

from pathlib import Path
import json, math, time
import numpy as np
import opensim as osim

try:
    from .wholebody import NAMES as WHOLEBODY_NAMES, CONTROLS as WHOLEBODY_CONTROLS, GROUPS as WHOLEBODY_GROUPS, ADAPTER as WHOLEBODY_ADAPTER
    from .runtime import calculation_version, native_identity
    from .spine import NAMES as SPINE_NAMES, CONTROLS as SPINE_CONTROLS, LEVELS as SPINE_LEVELS, DEFAULT_LEVEL
    from .neck import NAMES as NECK_NAMES, CONTROLS as NECK_CONTROLS
    from .girdle import CONTROLS as GIRDLE_CONTROLS, assemble as assemble_girdle
except ImportError:
    from wholebody import NAMES as WHOLEBODY_NAMES, CONTROLS as WHOLEBODY_CONTROLS, GROUPS as WHOLEBODY_GROUPS, ADAPTER as WHOLEBODY_ADAPTER
    from runtime import calculation_version, native_identity
    from spine import NAMES as SPINE_NAMES, CONTROLS as SPINE_CONTROLS, LEVELS as SPINE_LEVELS, DEFAULT_LEVEL
    from neck import NAMES as NECK_NAMES, CONTROLS as NECK_CONTROLS
    from girdle import CONTROLS as GIRDLE_CONTROLS, assemble as assemble_girdle

ROOT = Path(__file__).resolve().parent
osim.Logger.setLevelString("error")
VERSION = osim.GetVersionAndDate()
MANIFEST = json.loads((ROOT / "models/manifest.json").read_text())

ARM_NAMES = {
    "TRIlong": "Triceps · long head",
    "TRIlat": "Triceps · lateral head",
    "TRImed": "Triceps · medial head",
    "ANC": "Anconeus",
    "SUP": "Supinator",
    "BIClong": "Biceps · long head",
    "BICshort": "Biceps · short head",
    "BRA": "Brachialis",
    "BRD": "Brachioradialis",
    "ECRL": "Extensor carpi radialis longus",
    "ECRB": "Extensor carpi radialis brevis",
    "ECU": "Extensor carpi ulnaris",
    "FCR": "Flexor carpi radialis",
    "FCU": "Flexor carpi ulnaris",
    "PL": "Palmaris longus",
    "PT": "Pronator teres",
    "PQ": "Pronator quadratus",
}

SHOULDER_NAMES = {
    "TrapeziusScapula_M": "Trapezius · middle",
    "TrapeziusScapula_S": "Trapezius · superior",
    "TrapeziusScapula_I": "Trapezius · inferior",
    "TrapeziusClavicle_S": "Trapezius · clavicular",
    "SerratusAnterior_I": "Serratus anterior · inferior",
    "SerratusAnterior_M": "Serratus anterior · middle",
    "SerratusAnterior_S": "Serratus anterior · superior",
    "Rhomboideus_S": "Rhomboids · superior",
    "Rhomboideus_I": "Rhomboids · inferior",
    "LevatorScapulae": "Levator scapulae",
    "Coracobrachialis": "Coracobrachialis",
    "DeltoideusClavicle_A": "Deltoid · anterior",
    "DeltoideusScapula_P": "Deltoid · posterior",
    "DeltoideusScapula_M": "Deltoid · middle",
    "LatissimusDorsi_S": "Latissimus dorsi · superior",
    "LatissimusDorsi_M": "Latissimus dorsi · middle",
    "LatissimusDorsi_I": "Latissimus dorsi · inferior",
    "PectoralisMajorClavicle_S": "Pectoralis major · clavicular",
    "PectoralisMajorThorax_I": "Pectoralis major · inferior",
    "PectoralisMajorThorax_M": "Pectoralis major · middle",
    "TeresMajor": "Teres major",
    "Infraspinatus_I": "Infraspinatus · inferior",
    "Infraspinatus_S": "Infraspinatus · superior",
    "PectoralisMinor": "Pectoralis minor",
    "TeresMinor": "Teres minor",
    "Subscapularis_S": "Subscapularis · superior",
    "Subscapularis_M": "Subscapularis · middle",
    "Subscapularis_I": "Subscapularis · inferior",
    "Supraspinatus_P": "Supraspinatus · posterior",
    "Supraspinatus_A": "Supraspinatus · anterior",
    "TRIlong": "Triceps · long head",
    "BIC_long": "Biceps · long head",
    "BIC_brevis": "Biceps · short head",
}
HIP_NAMES = {
    "edl": "Extensor digitorum longus",
    "ehl": "Extensor hallucis longus",
    "fdl": "Flexor digitorum longus",
    "fhl": "Flexor hallucis longus",
    "gaslat": "Gastrocnemius · lateral head",
    "gasmed": "Gastrocnemius · medial head",
    "perbrev": "Fibularis brevis",
    "perlong": "Fibularis longus",
    "soleus": "Soleus",
    "tibant": "Tibialis anterior",
    "tibpost": "Tibialis posterior",
    "addbrev": "Adductor brevis",
    "addlong": "Adductor longus",
    "addmagDist": "Adductor magnus · distal",
    "addmagIsch": "Adductor magnus · ischial",
    "addmagMid": "Adductor magnus · middle",
    "addmagProx": "Adductor magnus · proximal",
    "bflh": "Biceps femoris · long head",
    "bfsh": "Biceps femoris · short head",
    "grac": "Gracilis",
    "iliacus": "Iliacus",
    "piri": "Piriformis",
    "psoas": "Psoas",
    "recfem": "Rectus femoris",
    "sart": "Sartorius",
    "semimem": "Semimembranosus",
    "semiten": "Semitendinosus",
    "tfl": "Tensor fasciae latae",
    "vasint": "Vastus intermedius",
    "vaslat": "Vastus lateralis",
    "vasmed": "Vastus medialis",
}
for key, label in [
    ("glmax", "Gluteus maximus"),
    ("glmed", "Gluteus medius"),
    ("glmin", "Gluteus minimus"),
]:
    for i in range(1, 4):
        HIP_NAMES[key + str(i)] = label + " · compartment " + str(i)


def vec(v):
    return [float(v.get(i)) for i in range(3)]


def transform(t):
    return [
        [float(t.R().get(i, j)) for j in range(3)] + [float(t.p().get(i))]
        for i in range(3)
    ]


def apply(t, p):
    return t.shiftFrameStationToBase(p)


def read_motion(path):
    lines = path.read_text().splitlines()
    start = lines.index("endheader") + 1
    return np.genfromtxt(lines[start:], names=True)


class ModelEngine:
    def __init__(self, region):
        self.region = region
        self.source_region = "spine" if region == "wholebody" else region
        self.model_version = MANIFEST[self.source_region]["sha256"]
        self.calculation_version = calculation_version(self.model_version + (":" + WHOLEBODY_ADAPTER if region == "wholebody" else ""))
        self.directory = ROOT / "models" / self.source_region
        self.model = osim.Model(str(self.directory / "model.osim"))
        self.state = self.model.initSystem()
        self.model.realizePosition(self.state)
        self.coordinates = {c.getName(): c for c in self.model.getCoordinateSet()}
        self.default = {n: c.getValue(self.state) for n, c in self.coordinates.items()}
        self.muscles = [
            m
            for m in self.model.getMuscles()
            if region in ("shoulder", "wholebody")
            or (region == "arm" and m.getName() in ARM_NAMES)
            or (region == "spine" and m.getName() in SPINE_NAMES)
            or (region == "neck" and m.getName() in NECK_NAMES)
            or (
                region == "hip"
                and m.getName().endswith("_r")
                and m.getName()[:-2] in HIP_NAMES
            )
        ]
        self.controls = (
            [
                dict(
                    id="plane_elv",
                    axis="",
                    label="Plane of elevation",
                    detail="0° = abduction/adduction; 90° = flexion/extension",
                    min=-30,
                    max=90,
                ),
                dict(
                    id="axial_rot",
                    axis="",
                    label="Shoulder internal / external rotation",
                    detail="Humerus rotation relative to the scapula",
                    min=-60,
                    max=85,
                ),
                dict(
                    id="shoulder_elv",
                    axis="",
                    label="Shoulder elevation (abduction / flexion)",
                    detail="Glenohumeral elevation; not total arm elevation",
                    min=5,
                    max=100,
                ),
            ]
            if region == "shoulder"
            else [
                dict(
                    id="hip_flexion_r",
                    axis="X",
                    label="Hip flexion / extension",
                    detail="Positive = flexion",
                    min=-20,
                    max=100,
                ),
                dict(
                    id="hip_rotation_r",
                    axis="Y",
                    label="Hip internal / external rotation",
                    detail="Positive = internal rotation",
                    min=-30,
                    max=30,
                ),
                dict(
                    id="hip_adduction_r",
                    axis="Z",
                    label="Hip adduction / abduction",
                    detail="Positive = adduction; negative = abduction",
                    min=-35,
                    max=20,
                ),
                dict(
                    id="knee_angle_r",
                    axis="K",
                    label="Knee flexion",
                    detail="Changes lengths of muscles spanning both joints",
                    min=0,
                    max=120,
                ),
                dict(
                    id="ankle_angle_r",
                    axis="A",
                    label="Ankle dorsiflexion / plantarflexion",
                    detail="Positive = dorsiflexion; negative = plantarflexion",
                    min=-40,
                    max=25,
                ),
                dict(
                    id="subtalar_angle_r",
                    axis="S",
                    label="Subtalar inversion / eversion",
                    detail="Positive = inversion; negative = eversion",
                    min=-15,
                    max=20,
                ),
            ]
        )
        if region == "arm":
            self.controls = [
                dict(
                    id="elbow_flexion",
                    axis="E",
                    label="Elbow flexion",
                    detail="0° = straight; positive = bend the elbow",
                    min=0,
                    max=130,
                ),
                dict(
                    id="pro_sup",
                    axis="R",
                    label="Forearm pronation / supination",
                    detail="Positive = pronation; negative = supination; 0° = thumb-up neutral",
                    min=-80,
                    max=80,
                ),
                dict(
                    id="flexion",
                    axis="W",
                    label="Wrist flexion / extension",
                    detail="Positive = palm toward forearm; negative = extension",
                    min=-60,
                    max=60,
                ),
                dict(
                    id="deviation",
                    axis="D",
                    label="Wrist ulnar / radial deviation",
                    detail="Positive = little-finger side; negative = thumb side",
                    min=-10,
                    max=25,
                ),
            ]
        if region == "neck":
            self.controls = [dict(c) for c in NECK_CONTROLS]
        if region == "shoulder":
            self.controls += [dict(c) for c in GIRDLE_CONTROLS]
        if region == "spine":
            self.controls = [dict(c) for c in SPINE_CONTROLS]
        if region == "wholebody":
            self.controls = [dict(c) for c in WHOLEBODY_CONTROLS]
        self.scales = {c["id"]: c.get("scale", 1) for c in self.controls}
        for c in self.controls:
            c["default"] = math.degrees(self.default[c["id"]]) / self.scales[c["id"]]
        # MoBL declares its coupled wrist coordinates as MotionType::Coupled,
        # but these two exposed generalized coordinates are angles. The browser
        # contract uses degrees for every slider and returned slider coordinate.
        self.angular_coordinates = {
            n for n, c in self.coordinates.items() if c.getMotionType() == 1
        } | {c["id"] for c in self.controls}
        self.tracks = {}
        if region == "shoulder":
            for key in ["ABD01", "FLX01", "SHRUG01"]:
                self.tracks[key] = read_motion(self.directory / (key + ".mot"))
        self.meshes = []
        self.frames = {}
        for component in self.model.getComponentsList():
            if component.getConcreteClassName() != "Mesh":
                continue
            mesh = osim.Mesh.safeDownCast(component)
            frame = mesh.getFrame()
            name = frame.getAbsolutePathString()
            if region == "hip" and not any(
                "/" + b in name
                for b in [
                    "pelvis",
                    "femur_r",
                    "tibia_r",
                    "patella_r",
                    "talus_r",
                    "calcn_r",
                    "toes_r",
                ]
            ):
                continue
            if region == "spine" and not any("/bodyset/" + b in name for b in ["pelvis", "sacrum", "lumbar", "thoracic", "rib", "sternum", "clavicle", "scapula", "humerus", "head_neck", "femur"]):
                continue
            path = self.directory / "Geometry" / mesh.get_mesh_file()
            if not path.is_file():
                continue
            poly = osim.PolygonalMesh()
            poly.loadFile(str(path))
            scale = vec(mesh.get_scale_factors())
            vertices = [
                [x * scale[i] for i, x in enumerate(vec(poly.getVertexPosition(j)))]
                for j in range(poly.getNumVertices())
            ]
            indices = []
            for j in range(poly.getNumFaces()):
                face = [
                    poly.getFaceVertex(j, k)
                    for k in range(poly.getNumVerticesForFace(j))
                ]
                for k in range(1, len(face) - 1):
                    indices.extend([face[0], face[k], face[k + 1]])
            self.meshes.append(
                dict(
                    frame=name,
                    vertices=vertices,
                    indices=indices,
                    name=mesh.get_mesh_file(),
                    id=mesh.getAbsolutePathString(),
                    label=frame.getName() + " · " + mesh.get_mesh_file().removesuffix(".vtp"),
                )
            )
            self.frames[name] = frame
        self.baseline = self.evaluate({})

    def config(self):
        return dict(
            region=self.region,
            name="Bruno / Bern whole body"
            if self.region == "wholebody"
            else "Bruno thoracolumbar spine"
            if self.region == "spine"
            else "Vasavada / Mortensen neck"
            if self.region == "neck"
            else "Seth / Belli shoulder"
            if self.region == "shoulder"
            else "MoBL-ARMS elbow and wrist"
            if self.region == "arm"
            else "Lai–Uhlrich lower limb",
            side="Both" if self.region in ("neck", "spine", "wholebody") else "Right",
            version=self.calculation_version,
            modelVersion=self.model_version,
            calculationBuild=native_identity()["id"],
            engine=VERSION,
            coordinateUnits={
                n: (
                    "°"
                    if n in self.angular_coordinates
                    else "m"
                    if c.getMotionType() == 2
                    else "rad (coupled)"
                )
                for n, c in self.coordinates.items()
            },
            controls=self.controls,
            controlGroups=WHOLEBODY_GROUPS if self.region == "wholebody" else [],
            meshes=self.meshes,
            muscles=[
                dict(id=self.sample_id(m.getName()), name=self.name(m.getName())) for m in self.muscles
            ],
            baseline=self.baseline,
            source=MANIFEST[self.source_region].get("sourceUrl")
            or "https://github.com/"
            + MANIFEST[self.source_region]["repository"]
            + "/tree/"
            + MANIFEST[self.source_region]["commit"],
            paper=MANIFEST[self.source_region]["paper"]
            if self.region in ("neck", "spine", "wholebody")
            else "https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00090/full"
            if self.region == "shoulder"
            else "https://pmc.ncbi.nlm.nih.gov/articles/PMC4282829/"
            if self.region == "arm"
            else "https://pubmed.ncbi.nlm.nih.gov/28900782/",
            tracks=[
                dict(
                    id=k,
                    label={
                        "ABD01": "Recorded abduction",
                        "FLX01": "Recorded flexion",
                        "SHRUG01": "Recorded shrug",
                    }[k],
                    duration=float(v["time"][-1]),
                )
                for k, v in self.tracks.items()
            ],
        )

    def sample_id(self, id):
        return self.region + "__" + id if self.region in ("spine", "wholebody") else id

    def name(self, id):
        return (
            WHOLEBODY_NAMES[id]
            if self.region == "wholebody"
            else SPINE_NAMES[id]
            if self.region == "spine"
            else NECK_NAMES[id]
            if self.region == "neck"
            else SHOULDER_NAMES[id]
            if self.region == "shoulder"
            else ARM_NAMES[id]
            if self.region == "arm"
            else HIP_NAMES[id[:-2]]
        )

    def path(self, m):
        gp = m.getGeometryPath()
        gp.getLength(self.state)
        pts = gp.getCurrentPath(self.state)
        out = []
        for i in range(pts.getSize()):
            p = pts.get(i)
            wp = osim.PathWrapPoint.safeDownCast(p)
            if wp:
                arc = wp.getWrapPath(self.state)
                t = wp.getParentFrame().getTransformInGround(self.state)
                for j in range(arc.getSize()):
                    out.append(vec(apply(t, arc.get(j))))
            else:
                out.append(vec(p.getLocationInGround(self.state)))
        return out

    def evaluate(self, request):
        start = time.perf_counter()
        values = dict(self.default)
        mode = request.get("track", "manual")
        progress = request.get("progress", 0)
        if mode != "manual":
            if mode not in self.tracks:
                raise ValueError("Unknown reference movement")
            if (
                not isinstance(progress, (int, float))
                or not math.isfinite(progress)
                or not 0 <= progress <= 100
            ):
                raise ValueError("Invalid movement progress")
            track = self.tracks[mode]
            t = track["time"][0] + progress / 100 * (
                track["time"][-1] - track["time"][0]
            )
            for n, c in self.coordinates.items():
                if n in track.dtype.names:
                    v = float(np.interp(t, track["time"], track[n]))
                    values[n] = math.radians(v) if c.getMotionType() == 1 else v
        else:
            allowed = {c["id"]: c for c in self.controls}
            for n, v in request.get("coordinates", {}).items():
                if (
                    n not in allowed
                    or not isinstance(v, (int, float))
                    or isinstance(v, bool)
                    or not math.isfinite(v)
                ):
                    raise ValueError("Invalid joint coordinate")
                control = allowed[n]
                if v < control["min"] - 1e-6 or v > control["max"] + 1e-6:
                    raise ValueError("Coordinate outside exploration limits")
                values[n] = math.radians(v * self.scales[n])
        evaluated_controls = self.controls
        if self.region == "spine":
            level = request.get("spineLevel", DEFAULT_LEVEL)
            if level not in SPINE_LEVELS:
                raise ValueError("Unknown spinal level")
            evaluated_controls = [c for c in self.controls if c["level"] == level]
        if self.region == "wholebody":
            # This workspace compares path lengths, without inferring joint actions.
            evaluated_controls = []
        # Moving points and wrapping can make native moment arms disagree with
        # the derivative of native path length. Check the new arm model locally;
        # keep both native outputs, but do not teach an inconsistent action.
        derivatives = {}
        local_jumps = set()
        if self.region in ("arm", "neck", "spine") or (self.region == "shoulder" and mode == "manual"):
            for control in evaluated_controls:
                name = control["id"]
                angle = math.degrees(values[name])
                lo = max(control["min"], angle - 0.01)
                hi = min(control["max"], angle + 0.01)
                lengths = []
                for offset in (lo, hi):
                    probe_values = {**values, name: math.radians(offset)}
                    if self.region == "shoulder":
                        probe = assemble_girdle(self.model, self.coordinates, probe_values)
                    else:
                        probe = self.model.initializeState()
                        for n, v in probe_values.items():
                            self.coordinates[n].setValue(probe, v, False)
                        self.model.assemble(probe)
                        self.model.realizePosition(probe)
                    lengths.append(
                        {m.getName(): m.getLength(probe) for m in self.muscles}
                    )
                derivatives[name] = {}
                for m in self.muscles:
                    mid = m.getName()
                    change = lengths[1][mid] - lengths[0][mid]
                    derivatives[name][mid] = -change / math.radians(hi - lo)
                    if abs(change) > 0.002:
                        local_jumps.add(mid)
        # Begin from the same initialized state every time. Constraints and wrapping
        # must not depend on the order in which the user visits poses.
        if self.region == "shoulder" and mode == "manual":
            self.state = assemble_girdle(self.model, self.coordinates, values)
        else:
            self.state = self.model.initializeState()
            for n, v in values.items():
                self.coordinates[n].setValue(self.state, v, False)
            self.model.assemble(self.state)
            self.model.realizePosition(self.state)
        samples = []
        for m in self.muscles:
            length = m.getLength(self.state)
            path = self.path(m)
            if (
                not math.isfinite(length)
                or length <= 0
                or any(not math.isfinite(v) for p in path for v in p)
            ):
                raise ValueError("Model could not evaluate this pose")
            drawing_error = abs(
                sum(math.dist(a, b) for a, b in zip(path, path[1:])) - length
            )
            reason = (
                "The exported path differs from the native length by more than 1 mm."
                if drawing_error > 0.001
                else None
            )
            if (
                self.region == "arm"
                and m.getName() == "SUP"
                and math.degrees(self.coordinates["pro_sup"].getValue(self.state))
                > 1e-6
            ):
                reason = "Supinator routing is unreliable in pronated poses. Return to neutral or supination to compare this path."
            if m.getName() in local_jumps:
                reason = "This path jumps near the selected pose, so its drawing and comparison are withheld."
            moments = {
                c["id"]: m.computeMomentArm(self.state, self.coordinates[c["id"]])
                for c in evaluated_controls
            }
            moment_errors = {
                n: abs(derivatives[n][m.getName()] - moments[n]) * 1000
                for n in derivatives
            }
            samples.append(
                dict(
                    id=self.sample_id(m.getName()),
                    length=length,
                    path=path if reason is None else [],
                    available=reason is None,
                    unavailableReason=reason,
                    pathErrorMm=drawing_error * 1000,
                    momentArms=moments,
                    momentArmErrorMm=moment_errors,
                    momentArmAvailable={
                        n: error <= 0.5 and reason is None and not n.startswith("scapula_")
                        for n, error in moment_errors.items()
                    } | ({c["id"]: False for c in GIRDLE_CONTROLS} if self.region == "shoulder" else {}),
                    originFrame=m.getGeometryPath()
                    .getPathPointSet()
                    .get(0)
                    .getParentFrame()
                    .getName(),
                    insertionFrame=m.getGeometryPath()
                    .getPathPointSet()
                    .get(m.getGeometryPath().getPathPointSet().getSize() - 1)
                    .getParentFrame()
                    .getName(),
                )
            )
        return dict(
            region=self.region,
            version=self.calculation_version,
            modelVersion=self.model_version,
            calculationBuild=native_identity()["id"],
            track=mode,
            progress=progress,
            coordinates={
                n: (
                    math.degrees(c.getValue(self.state)) / self.scales.get(n, 1)
                    if n in self.angular_coordinates
                    else c.getValue(self.state)
                )
                for n, c in self.coordinates.items()
            },
            muscles=samples,
            transforms={
                n: transform(f.getTransformInGround(self.state))
                for n, f in self.frames.items()
            },
            elapsedMs=round((time.perf_counter() - start) * 1000, 2),
        )
