# OpenSim integration plan

## Current product direction — September 18, 2026

The user primarily uses the sliders and muscle-length comparisons. The current interface removes quizzes from Movement Lab and the deltoid close-up, removes the Learn in 3D entry points, and removes the What to look for panel. Movement Lab is the home screen, with a searchable Anatomy reference integrated into it and saved reference poses retained. My notes, the notes editor, bookmarks and export have been removed; existing browser data is retained. The separate Explore destination is removed; the broader atlas remains accessible with Modeled / Anatomy only coverage labels and links to the corresponding native workspaces. Example poses are optional and collapsed. Earlier instructions in this document about preserving a continuous quiz experience are historical.

The separate whole-body option is implemented with a connected Bruno / Bern source skeleton, 598 paths, 72 grouped controls, shared saved references and independent regional state. Source locks and muscle-coverage limits remain visible. See [the source inventory and scientific requirements](biomechanics/reports/WHOLE_BODY_DIRECTION.md). Ankle dorsiflexion can affect sciatic-nerve mechanics in the thigh; this must not be presented as directly measured hamstring elongation or simulated tissue tension.

Whole body now defaults to the selected muscle family, with one highlighted strand and optional regional display layers. All paths is an explicit mode. Side filters, adjustable bone opacity, fixed screen-space line widths and optional small attachment markers reduce clutter; the individual native path retains its own length readout, distinct from the broader resting atlas muscle.

Find longest path searches the selected native path within the current slider limits, with optional joint locks, automatic application and Undo. It searches multiple starts, rejects unreliable geometry and validates the winning candidate through the existing pose engine. The result is the longest found within a finite search budget, not a global-optimum guarantee or a prescribed stretch. See [solver details](biomechanics/reports/LONGEST_PATH_SEARCH.md).

## Previous implementation history

Status: **implementation authorized by the user and completed as a local feasibility integration** (September 2026). Read [biomechanics/README.md](biomechanics/README.md) and [the numerical/evidence report](biomechanics/reports/EVIDENCE.md) for the current implementation. The research sequence below is retained as the original plan.

Implemented: pinned OpenSim 4.6 environment, unchanged shoulder/hip source models, native coordinate/constraint evaluation, model bones and wrapped paths in the browser, saved reference comparisons, continuous pose prediction, geometry gates and reproducible checks. The former custom muscle deformation was removed.

Decisions from the feasibility checks:

- Use a small local native service rather than precomputing a multidimensional offline approximation. Native pose latency is sufficient for interactive controls and avoids interpolating wrapping transitions.
- Select the subject-scaled Seth/Belli shoulder package and Lai–Uhlrich 2022 hip model. Exact commits and hashes are saved locally.
- Preserve the shoulder study's locked elbow; an unlock experiment produced an implausible triceps response. Manual scapular coordinates stay fixed, while study tracks include scapular motion.
- Withhold multiply-wrapped paths where exported geometry disagrees with native length by more than 1 mm. This is not biological validation.
- Preserve existing atlas notes and learning data. Add a separate movement-practice history.
- The separate hip display-geometry files are excluded from Git and fetched from checksum-pinned upstream paths during setup; their individual redistribution terms remain unresolved. Full offline coverage and clinical validation remain outside this local prototype.

## Objective and user preferences

Build a browser-based tool for a personal trainer to learn anatomy, muscle actions, and which muscle–tendon regions lengthen or shorten between positions. Initial movement scope: **shoulder and hip**, including neighboring joints where needed. Longer-term interest: other joints.

Keep the X/Y/Z slider interaction, selectable anatomy, rotation, isolation, notes, and continuous learning. The user rejected static lesson cards, completion checklists, and “mark reviewed” controls. Learning should involve exploration, prediction, feedback, and revisiting concepts.

The user values scientific credibility over plausible-looking animation. Do not present muscle surface distortion as evidence of stretching. Distinguish muscle–tendon length change from fiber strain, activation, tension, felt stretch, or safe end range.

## Pre-integration implementation (historical)

React/TypeScript/Vite/Three.js app; no backend or OpenSim integration. The Z-Anatomy/BodyParts3D GLB contains 826 meshes with resting coordinates and anatomical names, but no animation rig or animation clips.

The now-removed `src/shoulderMotion.ts` contained assistant-created shoulder pivots and coordinate-based deformation weights. Its wing-like deltoid and chest/back distortions are artifacts, not validated anatomy. The current software tests establish implementation behavior, not biological validity. Retain the atlas as a reference; replace this motion foundation when implementation is authorized.

Main integration points: `src/AnatomyViewer.tsx`, `src/shoulderMotion.ts`, `src/ContinuousLearning.tsx`, `src/learning.ts`, `src/data.ts`, and `tests/motion.spec.ts`. Preserve stored notes/bookmarks and continuous learning history.

## Model audit before selection

| Area | Candidate | Decision to resolve |
| --- | --- | --- |
| Shoulder | Seth thoracoscapular model (2019) | Muscle coverage, scapular-position policy, supported poses, exact package/license, compatibility. Published task comparisons involved one participant; do not claim all stretch positions are validated. |
| Hip/knee | Arnold lower-limb model (2010) | Muscle paths and length calculations; custom license and limitations at deep joint angles require review. |
| Hip/knee alternative | Lai model (2017) | Compare suitability for substantial hip/knee flexion. Catalog lists MIT; verify the actual package and its geometry licenses. |

Record model version/checksum, muscle compartments, coordinate definitions, constraints, default poses, supplied geometry, tested ranges, limitations, source publications, and redistribution terms. OpenSim's Apache-2.0 software license does not establish the license of each model. Some SimTK download pages were inaccessible during planning; actual package contents and licenses have not been verified.

## Implementation sequence, once authorized

1. **Native calculation prototype.** Create an isolated, pinned Python/OpenSim environment. Official Python packages are documented for OpenSim 4.6; verify platform/model compatibility. Load original models without modifying their anatomy. Set coordinates, resolve constraints, and extract bone transforms, wrapped muscle paths, muscle–tendon lengths, and moment arms. Start with a small reproducible set of shoulder and hip poses. Position-dependent length calculations do not require starting with full activation/force simulations.

2. **Define the controls.** Keep three labeled sliders but replace the current rotations with audited conversions to each model's coordinate system. Verify signs, degrees/radians, rest offsets, rotation order, and left/right conventions. Include knee position for hip-crossing muscles and elbow position where relevant to the shoulder. State all fixed coordinates and defaults.

3. **Resolve scapular motion explicitly.** Three arm angles do not uniquely determine shoulder-blade position. Initially reproduce published shoulder reference movements with their accompanying scapular motion. Before enabling unrestricted slider combinations, establish and test a documented scapular-position policy. If additional scapular coordinates must be specified, expose those assumptions/controls. Do not quietly invent a universal rhythm or equate glenohumeral angles with whole-arm elevation.

4. **Export a browser data package.** Preferred architecture: OpenSim/Python → versioned pose/geometry data → browser worker and Three.js. Native OpenSim remains the reference. Test bounded sampling and interpolation on held-out poses. FunctionBasedPath/PolynomialPathFitter may make length and moment-arm evaluation faster, but scalar formulas do not supply visible 3D paths; export/check those separately. Benchmark size, latency, and wrapping transitions before committing to full offline coverage. If necessary, narrow supported combinations or propose a small native OpenSim service rather than silently lowering accuracy.

5. **Build the movement view.** Use the research model's own bones and selectable paths drawn as lines or narrow bands. Keep the detailed atlas accessible for structure identification. Do not assume the atlas and research model align anatomically. Add saved reference poses and longer/shorter/little-change feedback per muscle compartment. Colors indicate modeled length change only. Unsupported poses or missing muscles must not acquire invented results.

6. **Reconnect learning.** Add pose-based predictions and explanations tied to attachments, model length changes, and moment arms. Store all joint coordinates, the reference pose, and model version with each question. Keep repeated practice and model exploration rather than adding a course-completion flow.

## Acceptance checks

- **Numerical agreement:** compare exported/browser results with native OpenSim at unseen and combined poses; check resets, constraint handling, coordinate conversions, wrapped paths, discontinuities, and consistent results independent of slider history. A provisional target of <1 mm length error is an engineering target only; tighten per compartment as needed. Suppress directional classifications when a change is too small relative to the error in both compared poses.
- **Anatomical evidence:** compare relevant model behavior with published moment-arm/length-change evidence within documented coverage. Reproducing OpenSim is not, by itself, biological validation. Record uncertainty and disagreements; never extend validated coverage solely because a coordinate accepts a larger angle.
- **Product behavior:** visible and usable sliders alongside the model, accessible keyboard controls, mobile/fullscreen layouts, preserved notes/history, correct label masking and help tracking, clear handling of unavailable data.

First milestone: **a small shoulder-and-hip feasibility prototype with actual OpenSim outputs, visible muscle paths, and a numerical/evidence report**. Implemented; see the linked report for measured results and remaining limitations.

## Research references

- [Seth shoulder model and limitations](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00090/full)
- [Arnold lower-limb documentation](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53087777)
- [Lai 2017 study](https://pubmed.ncbi.nlm.nih.gov/28900782/)
- [OpenSim model catalog and license listings](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090607/Mus)
- [Python installation](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53085346)
- [GeometryPath API](https://opensim-org.github.io/opensim-moco-site/docs/1.1.0/html_user/classOpenSim_1_1GeometryPath.html)
- [Function-based paths and fitting](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53091109/What%2Bs%2BNew%2Bin%2BOpenSim%2B4.5?pageId=5114711)
- [OpenSim core license](https://github.com/opensim-org/opensim-core/blob/main/LICENSE.txt)

When resuming after conversation compaction, read this document first, then check the user's latest instruction for authorization and scope changes.

## Deltoid visual milestone and regional roadmap (September 10, 2026)

The user authorized a recognizable single-deltoid motion trial, with hip, knee and ankle expansion in mind. **The animated surface trial failed visual review**: folds, bulk collapse and wing-like bulging persisted. Do not silently restore it or treat native path agreement as surface validation. The delivered fallback links unchanged atlas anatomy beside native moving bones/paths, region selection and repeatable predictions. See [the trial outcome and reproduction steps](biomechanics/reports/DELTOID_PROTOTYPE.md).

The existing X/Y/Z shoulder and hip controls and knee slider remain in Joint explorer. The ankle/subtalar milestone is now implemented; see the ankle integration update below. Credible moving muscle surfaces remain unresolved and should not block useful, explicitly separated anatomy and mechanics learning.

## Joint-wide learning correction (September 2026)

The user rejected making the one-deltoid trial the main experience: the goal is to learn the shoulder, hip and knee joints broadly. **Movement lab now opens the joint explorer**, with separate Shoulder/Hip/Knee entry points. The deltoid view is an optional close-up, and opening/closing it retains the live explorer state.

Each joint has three movement explorations, anatomical orientation, bone identification and camera focus, several featured muscle comparisons, and a four-prompt continuous prediction pool (12 prompts total). Lists order paths by absolute length change and can filter lengthening/shortening. Hip and knee share one native model and retain pose/reference when focus changes; knee flexion appears first in the knee workspace. The shoulder rotation quiz uses teres minor instead of the previously unreliable subscapularis path.

Coverage remains model bones and muscle–tendon paths, with the detailed upper-body atlas separately available. At this milestone, lower-body muscle references and ankle controls were not yet added; subsequent updates below cover both. Ligament/contact mechanics and credible animated muscle tissue remain outside the implementation. Native models/solver are unchanged. Existing notes, references and versioned learning history remain intact.

## Clickable muscle paths and atlas correspondence

The user asked to identify lines by clicking and show the corresponding muscle. The bundled GLB **already contains lower-limb muscles**; earlier claims that lower-body atlas assets were unavailable were based on the upper-body viewer's limited display and were incorrect. A full mesh-name inventory resolved this.

Added explicit mappings covering 33/33 shoulder and 28/29 hip/knee native compartments, using 42 extracted muscle/head regions. At that stage tensor fasciae latae had no named mesh in the bundled GLB; the source recovery below resolves this without substituting another structure. Compartment-to-whole-muscle mappings are labeled. The reference is a separate resting atlas body, never deformed around OpenSim bones.

Path hover names, forgiving mouse/touch selection, a persistent selected-path label and automatic reference opening now connect lines to recognizable anatomy. Names and reference panels remain hidden during unanswered prediction prompts. Source asset hashes, credit and mapping coverage are recorded in `public/models/muscle-reference/ATTRIBUTION.md` and `biomechanics/reports/muscle-atlas-coverage.json`. Re-export with `node scripts/export-muscle-atlas.mjs` while Vite is running.

## TFL/iliotibial-tract recovery (implemented)

User authorized completing the missing TFL reference. Retrieved original BodyParts3D right TFL (FJ1438) and iliotibial tract (FJ1423), verified official concept IDs, and preserved the corresponding source hip/femur/tibia/fibula. The source set is displayed separately because the bundled atlas bones differ; no forced registration or tissue deformation is introduced. Muscle and fascia have distinct colors and independent visibility controls. All 62 current native compartments now have a named muscle reference (43 distinct muscle/head surfaces plus one fascia surface). This is reference coverage, not a complete anatomy atlas or a new tissue simulation.

The reference now opens beside the movement canvas (stacked on narrower screens), without displacing the numerical muscle comparison. Native model geometry, calculations, sliders, references and quiz concealment remain intact. Source conversion is reproducible and each raw OBJ is hashed. See `biomechanics/reports/TFL_REFERENCE.md` and `scripts/audit-muscle-references.mjs`. Ankle/subtalar implementation remains a future milestone.

## Ankle integration — September 2026

Added an Ankle workspace sharing the lower-limb pose/reference with Hip and Knee. Exposed native ankle and subtalar coordinates, right foot meshes and all 40 right-leg muscle compartments, with static atlas references for all 11 newly exposed compartments. Three ankle explorations and four continuous prediction prompts bring the joint prompt pool to 16. Native model files are unchanged.

Ankle/subtalar action signs, foot transforms, fixed toes and a straight-knee versus bent-knee calf comparison are checked alongside the existing independent-model tests and coordinate sweeps. The pinned native package corrects stale wrap-point caches; source models and the geometry gate remain unchanged. Saved references are recalculated with the new build, and old learning attempts are retained separately from current-version scheduling. See [implementation and evidence](biomechanics/reports/ANKLE_WORKSPACE.md).
