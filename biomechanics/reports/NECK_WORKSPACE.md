# Neck workspace: SCM, scalenes and deeper cervical muscles

The workspace displays 52 bilateral muscle–tendon paths: three SCM compartments per side; anterior, middle and posterior scalenes; longus capitis/colli; trapezius; splenius; semispinalis; levator scapulae; longissimus; iliocostalis cervicis; and four suboccipital muscles. The source has 72 actuators; its 20 hyoid paths are outside this workspace. These are model compartments, not 52 distinct named muscles.

Four explorations compare leftward rotation, rightward side bending, upper-neck nodding and lower-neck flexion. Six prediction prompts include opposite-side SCM/scalene responses and the different effects of upper nodding on longus capitis and anterior scalene. References persist under the separate `neck` model key.

## Preserved source

The source file is [`models/reference/Mortensen2018.osim`](https://github.com/mjhmilla/kinematicPassengerModel/blob/b0eb96127ca07dea0266764e837faeaa397092b5/models/reference/Mortensen2018.osim), from the researcher repository `mjhmilla/kinematicPassengerModel`, commit `b0eb96127ca07dea0266764e837faeaa397092b5`. We use that reference model and its 15 matching `models/reference/Geometry` files, **not** the repository’s merged passenger model or its altered torso attachments.

Local `models/neck/model.osim` retains the downloaded bytes, SHA-256 `f85b25349a0132938769c18a9f1e6c3049b6e1395c12ffb693e03f38e51acf0b`. OpenSim upgrades its version-30000 XML in memory; no source joint, attachment, geometry, constraint or wrapping edits are applied. The pinned file identifies itself as `HYOID_Scaled`. It is a reference distribution with 72 actuators; we do not assume it is byte-identical to an article-era model or the login-protected SimTK download.

Model lineage and credits: [Vasavada, Li and Delp (1998), *Influence of muscle morphometry and moment arms on the moment-generating capacity of human neck muscles*](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim24/pages/54002303/Human+Neck+Model), and [Mortensen, Vasavada and Merryweather (2018), *The inclusion of hyoid muscles improve moment generating capacity and dynamic simulations in musculoskeletal models of the head and neck*](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0199912). The latter project’s [download-page terms](https://simtk.org/frs/?group_id=1404) grant MIT-style permissions. Preserve [the author notice](../models/neck/LICENSE.txt), the separate [mirror MIT notice](../models/neck/LICENSE-mirror.txt), and [mirror readme](../models/neck/README-mirror.md). These attributions do not establish separate clearance of every historic geometry contributor.

## Motion and interpretation

This is a cervical-spine model, not one freely rotating neck joint. Six original generalized coordinates control two regions; the source’s coupling constraints distribute motion between vertebrae. The torso, ribs and shoulder girdle stay at source defaults. The jaw remains fixed relative to the skull.

| Control | Application limits | Positive direction |
| --- | --- | --- |
| `pitch2` | −25–30° | Lower neck extension |
| `yaw2` | −20–20° | Lower neck turn left |
| `roll2` | −20–20° | Lower neck tilt right |
| `pitch1` | −12–15° | Upper neck extension / chin up |
| `yaw1` | −30–30° | Upper neck turn left |
| `roll1` | −5–5° | Upper neck tilt right |

Lower controls distribute motion from T1 to C2, upper controls from C2 to the skull. All six are angles even though OpenSim labels their native motion type “coupled”; the API and UI consistently use degrees. Torso translations remain metres. A combined pose does not make the simple sum of all sliders a measured head angle. Coupling and these conservative exploration limits are model assumptions, not an individual’s movement pattern or safe range.

SCM can have different modeled moment-arm signs for upper- and lower-neck bending. The source keeps those coordinates separate, which avoids teaching “neck flexion” as a single identical action at every level. The SCM compartments match the broader named sternocleidomastoid atlas surface; they are not independently segmented anatomical heads. Basic head/neck muscle context is linked to [OpenStax](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back).

The source SCM endpoint frames include rib cage or clavicle and skull. Its scalene routes run from the rib-cage segment to cervical vertebrae. Endpoint dots simplify attachment areas; they do not outline the full muscle origins/insertions. The model holds ribs fixed and does not calculate breathing, activation, tension, tissue strain, stability or a suitable stretch.

## Atlas coverage and missing anatomy

`public/models/muscle-reference/neck.json` contains 36 bilateral named muscle surfaces and 60 contextual bone meshes extracted from the bundled Z-Anatomy GLB. Original vertex positions, topology and world transforms are preserved. The source GLB uses negative X for the right side; the audit verifies right/left labels against that convention. No mesh is mirrored, fitted to OpenSim, deformed or synthesized.

These surfaces cover 48 of the 52 native paths, including every SCM and scalene compartment. Four semispinalis-capitis compartments have no matching surface in the bundled atlas. They keep their native calculations and show an explicit missing-reference message. The atlas’s **spinalis capitis** is a different named structure and is not substituted. The coverage report records these four intentional gaps separately from unexpected missing data.

The atlas is a separate resting body. A matching name does not establish geometric registration or agreement between atlas attachment locations and model endpoints. [Atlas attribution and licensing](../../public/models/muscle-reference/ATTRIBUTION.md) apply to this derivative export.

## Checks and result

Run `.venv-opensim/bin/python biomechanics/validate_neck.py`. The [native report](neck-audit.json), generated 2026-09-12, covers 238 one-degree single-control poses plus 150 seeded combined poses:

- 20,176 independent native-length comparisons across 388 poses and 52 paths.
- Maximum length discrepancy below 0.000001 mm; sampled repeated lengths identical.
- 4,056 independent finite-difference moment-arm checks; maximum accepted discrepancy 0.000161 mm.
- All displayed paths passed the 1 mm drawing gate in these samples. The gate, local jump check and 0.5 mm action-consistency gate remain active at runtime.
- Coordinate tracking, fixed torso, constraint residuals, bilateral symmetry, skull orientation signs and source attachment-frame checks passed.
- All six finite-change predictions passed the display’s 1 mm classification deadband.

These are engineering checks of the pinned model, not new validation against people or against the resting atlas. Sampling cannot establish correctness at every possible combined pose.

`node scripts/export-neck-atlas.mjs` reproduces the bilateral surfaces with Vite running on port 5173. `node scripts/audit-muscle-references.mjs` checks mesh indices, side labels and expected missing surfaces alongside the previous workspace mappings. `tests/neck.spec.ts` covers bilateral selection, upper/lower controls, native degree units, saved references, missing anatomy, predictions and invalid input. The shared mobile/accessibility check includes all seven workspaces.

Final integration checks on 2026-09-13: all 44 browser tests passed, including the seven-workspace mobile accessibility check. Neck framing and mobile checks were repeated after preserving both SCM endpoints when the atlas panel opens. The previous shoulder/lower-limb and 599-pose arm native regressions passed. All 153 pinned model inputs verified; atlas coverage is 138 of 142 total native paths, with four declared semispinalis-capitis surface gaps. Production preview on localhost:4173 was checked with the native service and bilateral neck atlas running.
