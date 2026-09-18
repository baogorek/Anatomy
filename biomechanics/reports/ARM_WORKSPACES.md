# Elbow and wrist workspaces

The two workspaces share one right-arm pose, one saved reference and 17 selected native muscle–tendon paths. Changing workspace preserves the pose. The shoulder workspace uses a separate model and reference. The resting atlas is a different body: matching names do not imply aligned endpoints, identical attachment areas or tissue deformation.

## Source and scope

The preserved source is `models/arm/source.osim`, originally `upper_body/unimanual/MoBL-ARMS Upper Extremity Model/MOBL_ARMS_fixed_41.osim` in the [Auctus/Inria model collection](https://gitlab.inria.fr/auctus-team/components/modelisation/humanmodels/opensim_models/-/tree/e0a35c698513df3809e80b9d10fe61f21145407b), commit `e0a35c698513df3809e80b9d10fe61f21145407b`. Its SHA-256 is `1dd78c05340dfedb4db51b85ba5353a84ab58ecd6a7f3f5e0b4fec134591bf98`. The 33 referenced geometry files and upstream readme were copied from that pinned collection. The original [MoBL-ARMS project](https://simtk.org/projects/upexdyn/) links a release that requires login; byte identity with that release zip has **not** been established.

The model lineage is Holzbaur → Saul → McFarland. The supplied readme identifies shoulder range/ligament updates and Millard actuators whose force curves match the older model. Our service evaluates geometry and does not simulate these forces. Required credits: [Saul et al., 2015, *Benchmarking of dynamic simulation predictions in two software platforms using an upper limb musculoskeletal model*](https://pubmed.ncbi.nlm.nih.gov/24995410/) and [McFarland et al., 2019, *Spatial Dependency of Glenohumeral Joint Stability During Dynamic Unimanual and Bimanual Pushing and Pulling*](https://doi.org/10.1115/1.4043035).

The author’s [full terms](../models/arm/LICENSE.txt), retrieved from the SimTK download page, include non-commercial research, academic, evaluation and personal use, attribution requirements and BSD-style conditions. Preserve the complete terms. Do not treat this as unrestricted commercial-use permission or as independent clearance of every historic bone-geometry contributor.

Paths included: three triceps heads, anconeus, two biceps heads, brachialis, brachioradialis, supinator, pronator teres, pronator quadratus, ECRL, ECRB, ECU, FCR, FCU and palmaris longus. This is a selected teaching set from 50 native compartments; it excludes shoulder-only and finger/thumb actuator paths. It does not represent every muscle affecting the wrist.

| Control | Exploration limits | Positive direction |
| --- | --- | --- |
| `elbow_flexion` | 0–130° | Bend elbow |
| `pro_sup` | −80–80° | Pronation; zero is thumb-up neutral |
| `flexion` | −60–60° | Wrist flexion, palm toward forearm |
| `deviation` | −10–25° | Ulnar deviation, toward little finger |

Limits are application exploration limits, not recommendations or measurements of a person's range. The source default shoulder pose is held: 30° elevation, 90° elevation plane and 0° rotation. Finger geometry remains in the source grip. The wrist uses coupled proximal/distal carpal motion; actual assembled coordinates and bone transforms come from OpenSim. Elbow hinge and radioulnar rotation are distinct motions, consistent with [OpenStax joint anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints). The original model’s anatomical construction and wrist coordinate conventions are described by [Holzbaur et al., 2005](https://nmbl.stanford.edu/publications/pdf/Holzbaur2005.pdf).

## ECRL correction

The preserved source assigns both ECRL wrapping surfaces to all path segments (`-1 -1`). In wrist extension, the elbow surface can select a distant segment: native length exceeds 800 mm, despite the exported drawing passing the 1 mm agreement check. Thus drawing/native agreement alone is insufficient.

The active `models/arm/model.osim` restricts elbow surface `Elbow_PT_ECRL` to points 1–2 and wrist surface `ECRL` to points 3–4, using OpenSim's one-based range indices. Only those two XML properties change. All attachments, wrapping surfaces, dimensions and joints are preserved. The [exact diff](../models/arm/ecrl-wrap-ranges.patch), source and derived hashes are retained. The audit verifies the entire XML equality after applying these two changes.

At otherwise default coordinates, corrected ECRL length changes from about 322 mm at 60° extension to 344 mm at 60° flexion. A one-degree sweep checks for the previous jump. This is an engineering correction with a plausible route, not new experimental validation of ECRL anatomy or every combined pose.

## What is withheld

- **Supinator in any pronated pose:** the source route has a large transition and inconsistent length trends. Restricting its wrap segment did not resolve that problem, so no supinator source edit is shipped. Its drawing and comparison are unavailable when either comparison pose is pronated. Its named atlas anatomy remains accessible.
- **Drawing disagreement:** any path whose polyline differs from native length by more than 1 mm is withheld. This also catches an FCU failure found in a combined pose. The raw discrepancy remains in the API/report for diagnosis.
- **Local jumps:** arm paths changing more than 2 mm over a local probe of up to 0.02° are withheld at that pose. This is a conservative discontinuity screen, not proof of global continuity.
- **Moment-arm disagreement:** each arm coordinate is probed at ±0.01° (one-sided at a control boundary). Native moment arms are compared with `−dL/dq`, with degrees converted to radians. A difference over 0.5 mm withholds that action readout. Native lengths and moment arms are retained separately in diagnostic output; the UI does not substitute a guessed action. A 0.01° independent-model check tests accepted readouts at sampled interior poses.

The source tags the generalized wrist coordinates as “coupled” rather than “rotational.” They nevertheless represent angles; the API explicitly returns them in degrees, matching their sliders. Native length transport and repetition must agree within 0.01 mm, one hundredth of the drawing gate. Requested and assembled controls must agree within 0.001°.

Moving points and wrapping approximations mean not every native moment arm is consistent with local path-length changes. The threshold is an application consistency policy, not a statement of biological precision. Finite length-change lessons are checked directly and separately. Neither accepted paths nor these probes establish muscle force, activation, fiber strain, passive tension, joint stability or a safe stretch.

## Reproduce

Run `.venv-opensim/bin/python biomechanics/validate_arm.py`. The [machine-readable report](arm-audit.json) records source/build identities, 449 one-degree single-control poses plus 150 seeded combined poses, independent native-length comparisons, repeated-pose checks, fixed shoulder/control checks, withheld paths/actions, finite-difference checks, all eight prediction outcomes and a separate 121-pose ECRL source-versus-correction sweep. All native computations use the installed source-built OpenSim package; no surrogate or mesh-derived mechanics are used.

`models/manifest.json` identifies the pinned Git source. To reproduce the active file from the preserved source, copy `source.osim` to a scratch `model.osim` and apply `ecrl-wrap-ranges.patch` there using `patch model.osim ecrl-wrap-ranges.patch`. Verify its SHA-256 against the manifest before replacing an active asset. `biomechanics/verify_assets.py` verifies all distributed input checksums.

With the development server running, `node scripts/export-muscle-atlas.mjs` exports the unchanged source atlas surfaces. `node scripts/audit-muscle-references.mjs` checks 17/17 arm correspondences, along with the existing shoulder/leg mappings. The new wrist bones preserve their original atlas placement. ECU, FCU and pronator teres each show both named atlas heads for the corresponding whole-muscle path.

Browser coverage in `tests/arm.spec.ts` checks shared poses/references, wrist bone focus, atlas selection, ECRL extension, supinator exclusion in either comparison pose, action exclusions and eight prediction outcomes. `tests/joints.spec.ts` checks mobile layout and automated accessibility for all six joints. The existing shoulder, gastrocnemius and tibialis-anterior native regressions remain part of `npm run test:biomechanics`.

## Recorded result, 2026-09-12

The installed-package audit passed 599 main poses and 10,183 independent native-length comparisons. Maximum length disagreement was 0.000527 mm; repeated lengths agreed exactly in the sampled repeats. Maximum requested/assembled coordinate difference was 0.000547°. The 1,411 sampled independent finite-difference checks had a maximum accepted action discrepancy of 0.490 mm. Supinator was withheld in 157 poses and FCU in one pose; these are recorded exclusions, not passing anatomical validations. All eight predictions and the separate 121-pose ECRL correction sweep passed. Median arm evaluation took 127 ms in this run.

The browser suite covered 40 cases; its existing failed-geometry wording assertion was restored and rechecked. All 12 arm/motion cases passed after the wrist-unit correction, and the supinator reference exclusion was rechecked after the drawing update. The existing shoulder/lower-limb, gastrocnemius and tibialis-anterior native regressions also passed. All 134 pinned input assets and all 90 native-path atlas correspondences were verified.
