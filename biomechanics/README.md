# OpenSim movement service

This local service evaluates muscle–tendon **geometry**, using the source-built OpenSim `4.6+kinetic.wrapcache1` package. It does not solve activation, forces, fiber strain, passive tension, stability, or tissue deformation. The browser displays research-model bones and compartment paths; the Z-Anatomy atlas remains a separate, static reference.

## Run and reproduce

Tested on Linux x86_64, Python 3.12.3, Node 24. OpenSim and NumPy versions are pinned in `requirements.txt`. From the project root:

```bash
npm run setup:biomechanics
npm run dev
```

The setup script uses `uv` when available, otherwise Python's `venv`/`pip`. The bundled wheel supports Linux x86_64 / CPython 3.12 and requires system BLAS/LAPACK libraries. Setup verifies the wheel checksum, installed native binary identity and all model asset checksums. The native environment is ignored by Git. Setup also downloads the 81 hip display meshes directly from the pinned upstream source and verifies each checksum; these local meshes are excluded from Git.

`npm run dev` and `npm run preview` launch the native service on **127.0.0.1:8765**, then Vite. Vite proxies `/api/biomechanics` so the browser uses one origin. The launcher reuses an already-running Kinetic native service only when its calculation build matches the pinned manifest. Restart that service after changing Python code. A static `dist/` deployment alone cannot calculate movements. Atlas-only development can use `npx vite --host 0.0.0.0` without Python; the movement view reports an unavailable service.

```bash
npm run test:biomechanics
.venv-opensim/bin/python biomechanics/audit_sweeps.py
npm test
```

The service's OpenSim models and states are protected by a lock. Each evaluation starts from an initialized state, assigns coordinates, assembles constraints and realizes position. Rendering transforms, wrapped paths, native lengths and native moment arms are returned as JSON. Invalid controls receive HTTP 400; model evaluation failures receive HTTP 422. There is no fabricated fallback. Browser requests are debounced, canceled and guarded against stale responses; pending and failed requests suppress length classifications.

## Chosen packages and provenance

`models/manifest.json` records immutable repository commits, upstream paths and original model SHA-256 hashes. `models/checksums.json` covers all pinned local model, geometry, license and reference files. Shoulder, lower-limb, neck and spine source models are unmodified. The arm source is preserved separately from its documented two-range adaptation.

- **Shoulder (API region `shoulder`):** the subject-scaled CMC/no-weight thoracoscapular model distributed with [Belli et al. (2023)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295003), based on [Seth et al. (2019)](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00090/full). 33 compartments; 17 stored coordinates with constraints/locks. We use its seven supplied display geometries and the `ABD01`, `FLX01`, `SHRUG01` inverse-kinematics files. Those tracks are model-estimated kinematics from study data, not direct measurements of all bones. Coordinate interpolation samples the supplied trajectories; all muscle lengths and paths are evaluated natively at that sample. AC constraint assembly may adjust the scapular/clavicular inputs.
- **Lower limb (API region `hip`):** `LaiUhlrich2022.osim` from the [OpenCap source repository](https://github.com/opencap-org/opencap-core), with 80 muscle compartments in the full model. The hip, knee and ankle workspaces share all 40 right-side muscle compartments and ten bone meshes (pelvis, right femur, tibia/fibula, patella, talus, combined heel/midfoot, and toes). The left leg is omitted from the view. Geometry files come from the matching Rajagopal/common geometry directories in `opensim-org/opensim-models`, at the commit recorded in the manifest. [Lai et al. (2017)](https://pubmed.ncbi.nlm.nih.gov/28900782/) refined the preceding lower-limb model for locomotor tasks. OpenCap's hosted recording/analysis service is not used.

- **Elbow and wrist (API region `arm`):** pinned MoBL-ARMS `MOBL_ARMS_fixed_41.osim` from the public Auctus/Inria collection, with 17 selected muscle paths and 33 display meshes. Original source retained as `models/arm/source.osim`; active model restricts ECRL wrapping to its intended segments. See [source, correction and audit](reports/ARM_WORKSPACES.md). The shoulder workspace remains a separate model.

- **Neck (API region `neck`):** preserved `Mortensen2018.osim` reference model and 15 matching meshes from a pinned researcher repository. Six original upper/lower cervical controls, 52 displayed bilateral muscle paths, fixed torso and source coupling. The app evaluates geometry; it does not run the publication’s force or dynamic simulations. See [source, controls, attribution and audit](reports/NECK_WORKSPACE.md).

- **Whole body (API region `wholebody`):** reuses the exact pinned Bruno/Bern spine source with all 598 muscles, 130 nonempty display meshes and 72 exposed coordinates. Bilateral hip/knee/ankle, shoulder and elbow controls join the 51 spinal controls and three lumped head/neck angles. Other source coordinates and locks remain at their defaults. The knee and left shoulder abduction/rotation slider signs are normalized; this workspace reports path lengths without moment-arm action claims. See [implementation, coverage and validation](reports/WHOLE_BODY_DIRECTION.md).

- **Spine (API region `spine`):** preserved Bruno/Bern Movement Lab full-body template, with all 552 upper-body fascicles and 17 individually controlled thoracic/lumbar joints. Three sliders per selected level; other joint angles persist. Eight additional deep-muscle atlas groups include rotatores, with no invented movement calculations. See [source, coverage and audit](reports/SPINE_WORKSPACE.md).

### Attribution and licensing

Shoulder data/model/geometry package: CC BY 4.0, Copyright 2023 Italo Belli, Sagar Joshi, J. Micah Prendergast, Irene Beck, Cosimo Della Santina, Luka Peternel and Ajay Seth. Preserve `models/shoulder/LICENSE.txt`; credit the original Seth model and the Belli modifications. Locally we convert display geometry and extract numerical values, retaining source anatomy.

Hip model source repository: Apache 2.0, preserved in `models/hip/LICENSE.txt`. Credit Rajagopal, Lai, Uhlrich and the OpenCap authors. **Separate bone-geometry license audit remains unresolved:** the pinned `opensim-models` distribution supplies these display files, but an explicit license covering every individual VTP file was not found. Their presence in an open-source repository is not proof of redistribution rights. These files are retained locally with full provenance and excluded from Git. `scripts/fetch-hip-geometry.py`, invoked by setup, fetches their exact pinned upstream versions and verifies their checksums. Resolve their terms before redistributing those files in a public model-data package. Do not label all geometry Apache 2.0 based solely on the OpenSim software license.

MoBL-ARMS: retain [the full author terms](models/arm/LICENSE.txt), including their non-commercial condition and required citations to Saul et al. (2015) and McFarland et al. (2019). This is not a blanket BSD license for commercial use or a claim that every historic geometry contributor has been separately cleared.

## Controls and fixed coordinates

| Region | Control | Exploration interval | Convention |
|---|---|---|---|
| Shoulder | `plane_elv` | −30° to 90° | Native elevation plane, sideward toward forward |
| Shoulder | `axial_rot` | −60° to 85° | Native humeral axial rotation, relative to scapula |
| Shoulder | `shoulder_elv` | 5° to 100° | Glenohumeral elevation, not total arm elevation |
| Hip | X `hip_flexion_r` | −20° to 100° | Positive flexion |
| Hip | Y `hip_rotation_r` | −30° to 30° | Positive internal rotation |
| Hip | Z `hip_adduction_r` | −35° to 20° | Positive adduction; negative abduction |
| Lower limb | K `knee_angle_r` | 0° to 120° | Positive flexion |
| Lower limb | A `ankle_angle_r` | −40° to 25° | Positive dorsiflexion; negative plantarflexion |
| Lower limb | S `subtalar_angle_r` | −15° to 20° | Positive inversion; negative eversion |

These are application exploration intervals, **not biologically validated stretch envelopes or clinical ROM recommendations**. Shoulder controls use anatomical names for the native elevation plane, humeral internal/external rotation and elevation; they are not Cartesian Euler rotations. We do not silently convert glenohumeral elevation to humerothoracic elevation or invent a scapulohumeral rhythm.

Manual shoulder mode starts from the source model's assembled pose. Three scapular sliders hold their requested coordinates while the clavicle and scapular winging are solved to preserve AC closure; the three arm controls remain independently adjustable. The elbow remains locked straight, and forearm pronation/supination remains at its source default. The supplied study movements move the scapula/clavicle with the arm. The UI exposes actual assembled values in its coordinate details. Hip manual mode holds the pelvis/trunk at defaults; dependent knee coordinates follow their native coupling. The toe (`mtp_angle_r`) coordinate stays at its source default of 0°. The ankle and subtalar joints each use the original model’s oblique pin axis; the heel/midfoot and toe segments are rigid. Unexposed unlocked coordinates can shift minutely within native assembly tolerances (see report).

Native rotational coordinates are converted degrees ↔ radians. Translation coordinates remain meters; coupled `knee_angle_*_beta` values are explicitly labeled radians. The browser uses a proper rotation (+X forward, +Y up, +Z right → viewer +Z forward), with positive determinant, and labels the modeled side **right**. Native mesh scales and physical-frame transforms are retained.

## Paths, comparisons and continuous learning

Path extraction follows OpenSim's `GeometryPath` rendering convention, including `PathWrapPoint.getWrapPath()` samples transformed through their parent physical frame. The renderer follows a piecewise linear version of those samples. It does not use the atlas vertices or fit a cosmetic muscle surface. Native `Muscle.getLength()` supplies all reported lengths; the displayed tube's radius has no physiological meaning.

A per-compartment geometry gate compares the exported polyline length with the native path length. If the difference exceeds **1 mm**, its drawing is omitted and comparisons involving that compartment/pose are unavailable. The corrected package resolves the previously observed stale wrap-point cache discrepancies in sampled shoulder and calf paths; the gate continues to reject any failing pose. It does not prove that all remaining routes are anatomically correct. Length color classifications use a separate ±1 mm display deadband; this is not a fiber-strain threshold or confidence interval.

Users can save a reference pose, return to the starting reference, select/isolate paths and inspect native moment arms. Saved references contain the source request, assembled coordinates, source model checksum and calculation identity; saved requests are re-evaluated on loading rather than trusting stored length values. Comparisons are within the same model/version only.

The current interface centers on slider exploration and saved reference comparisons. Quiz and notes interfaces are removed. The integrated anatomy catalog preserves broader static coverage and links verified anatomy matches to the corresponding native workspace. Existing historical browser data is left intact.

Find longest path searches one selected native path within the exposed slider bounds, with optional locked controls, cancellation and Undo. It applies the longest validated candidate found in its finite search budget. See [the search algorithm, gates and tests](reports/LONGEST_PATH_SEARCH.md).

## What remains outside this implementation

A full offline multidimensional approximation was not built: native evaluation is fast enough to avoid scalar/path interpolation errors, especially with shoulder constraints and wrapping. The current deployment therefore requires the local native service. The longest-path search is geometric, including in Whole body. It does not provide deformed muscle volumes, personalized anatomy, force simulation, validated stretch recommendations or a guarantee of a global optimum. See [the numerical and evidence report](reports/EVIDENCE.md) for limits and failures discovered during implementation.

## Ankle integration checks

See [ankle implementation and measured limitations](reports/ANKLE_WORKSPACE.md). The original model and source hashes remain unchanged. Existing saved hip/knee references are re-evaluated to include the new compartments. The calf exploration starts with a straight knee at 20° dorsiflexion, then compares knee flexion to 90°. Both gastroc heads have direct prediction prompts.

The [tibialis anterior correctness audit](reports/TIBIALIS_ANTERIOR.md) checks the inherited path points and basic ankle mechanics against anatomical and experimental evidence. Its single endpoints are not complete attachment regions. The app provides separate anatomical descriptions and calls out limits of the subtalar predictions. Exact registration to the atlas and a matched experimental moment-arm curve fit remain unvalidated.

## Corrected native package

[The runtime manifest](runtime-manifest.json) records the bundled wheel SHA-256, installed binary hashes, source/dependency revisions and patch hashes. Calculation versions combine the model checksum, adapter version and native build identity. Service startup rejects a different native package, and the browser rejects responses from a different calculation version.

The source patch invalidates inherited Point caches whenever a wrap point changes. It changes no source anatomy or drawing threshold. The package includes OpenSim/Simbody/spdlog license notices. It excludes CasADi, C3D import and the desktop visualizer, which this geometry service does not use.

To reproduce the build, install `uv`, GCC/G++, Git and BLAS/LAPACK development libraries, then run `bash scripts/build-opensim.sh`. This uses pinned CMake/Ninja/SWIG/Python build dependencies and writes a candidate wheel under ignored `.build-opensim/wheels/`. Install it into an isolated CPython 3.12 environment with NumPy 2.5.3, then use that interpreter to run `scripts/record-opensim-runtime.py <wheel>`. This records a new local bundle/manifest; run setup, native regressions and browser tests before accepting it. Compiler/platform changes can produce a different binary identity even from identical source.

The diagnostic interposer is retained only for reproducing the original investigation. The service and installed-package regression use the actual source-built libraries without `LD_PRELOAD`. See [the cache investigation](reports/GASTROCNEMIUS_CACHE.md).

Arm controls and checks are detailed in [ARM_WORKSPACES.md](reports/ARM_WORKSPACES.md). `validate_arm.py` checks the preserved source versus the two edited wrap ranges, native transport, shared coordinate constraints, local moment-arm consistency, eight predictions and the ECRL regression.

The bilateral neck atlas is reproduced with `node scripts/export-neck-atlas.mjs`. Native neck checks are included in `npm run test:biomechanics`; its 388-pose report distinguishes numerical consistency from biological validation.

The single Shoulder tab includes the three IK recordings, all 33 compartments and both arm and scapular controls. The three scapular controls hold independent angles while a strict native assembly solves clavicular position and scapular winging. Six resolved girdle angles remain inspectable. Its posterior view, shared-reference behavior, recorded scapular prediction poses and 303-pose native audit are documented in [SHOULDER_GIRDLE.md](reports/SHOULDER_GIRDLE.md).

Manual scapular controls: `scapula_abduction` −30° to 5° (increasing = protraction), `scapula_elevation` −10° to 10° (increasing = elevation), `scapula_upward_rot` 0° to 45° (increasing = upward rotation). These are model exploration limits. The solver holds these coordinates exactly, preserves AC closure, and solves `clav_prot`, `clav_elev` and `scapula_winging`. See [the 292-pose manual audit](reports/girdle-controls-audit.json).

The UI uses anatomical names without X/Y/Z or numbered girdle badges. `plane_elv` selects the elevation plane (0° sideways abduction, 90° forward flexion), `axial_rot` is humeral internal/external rotation, and `shoulder_elv` is glenohumeral elevation in the selected plane. This naming and workspace consolidation changes no calculations or saved-reference keys.
