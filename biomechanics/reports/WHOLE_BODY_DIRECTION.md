# Whole-body direction

Status: **implemented**, September 15, 2026. The separate Whole body option uses the pinned Bruno / Bern source as one connected model.

## Intended experience

Keep the existing regional Movement Lab and add a separate whole-body option: one person, one saved reference pose, joint controls grouped by region and side, and selectable muscles with continuous length comparisons. Regional focus should be a camera/control selection within that shared pose. Quizzes and guided lesson panels are not part of this direction.

## Ankle dorsiflexion and the hamstrings

The hamstrings do not cross the ankle. Ankle movement can nevertheless affect neural structures in the posterior thigh. Bueno-Gracia et al. measured 11 limbs from six fresh cadavers during straight-leg raising at four hip angles: adding dorsiflexion changed proximal sciatic-nerve strain and excursion, without a significant change in biceps-femoris strain at the measured location. This does not establish that every posterior-thigh sensation has a neural cause, or rule out every indirect connective-tissue interaction. [Original study, 2019](https://pubmed.ncbi.nlm.nih.gov/31374476/).

An in-vivo ultrasound study in 27 healthy participants also observed sciatic-nerve excursion in the posterior thigh during ankle dorsiflexion. Its results varied with joint position. [Original study, 2021](https://pubmed.ncbi.nlm.nih.gov/34036554/).

In the current lower-limb engine, holding hip flexion at 70° and knee flexion at 0° while setting ankle angle to −30°, 0°, and +20° produced no hamstring path-length change to six decimal places in millimeters (biceps femoris long and short heads, semimembranosus, semitendinosus). Relative to 0°, +20° dorsiflexion increased the medial gastrocnemius path by 14.310453 mm and soleus by 13.302074 mm. These are model outputs, not human tissue measurements.

The current engine computes geometry and moment arms; it has no nerve paths, neural strain, activation or passive-tension calculation. A whole-body muscle model alone would not supply those missing quantities. Continue labeling outputs as muscle–tendon lengthening/shortening. A nerve or fascia extension needs its own sourced geometry, boundary conditions and evidence before receiving quantitative readouts.

## Existing source inventory

Counts below come from the locally pinned `.osim` files, before application filtering. Coordinates include dependent and unexposed coordinates; counts do not imply independent or validated UI controls.

| Source | Bodies | Muscle actuators | Coordinates | Whole-body implications |
| --- | ---: | ---: | ---: | --- |
| Lai–Uhlrich lower-limb source | 22 | 80 | 35 | Contains both legs, torso and arms. Muscle actuators cover the legs; torso and head are lumped. It cannot supply the detailed neck, spine and shoulder behavior by widening the camera. |
| Bruno/Bern spine template | 78 | 598 | 165 | Contains bilateral limbs and a detailed thoracolumbar spine. The existing spine workspace selects 552 upper-body fascicles and a subset of display geometry. The head and neck are lumped; upper/lower-limb and scapular behavior require a separate audit. |
| Seth/Belli shoulder | 7 | 33 | 17 | Detailed right shoulder-girdle model; the study locks the elbow. |
| MoBL-ARMS | 11 | 50 | 20 | The current workspace selects 17 elbow, forearm and wrist paths. Separate source proportions and shoulder assumptions. |
| Vasavada/Mortensen neck | 16 | 72 | 30 | The current workspace selects 52 neck paths; prescribed upper/lower cervical coupling. |

Model files and hashes are in [the manifest](../models/manifest.json). The [OpenSim model catalog](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090607) is a starting point for comparing alternative integrated sources.

## Original implementation requirements

1. Compare integrated-source candidates against the existing controls and muscle coverage. The spine template provides a concrete starting candidate, but its lumped cervical region cannot replace the existing neck sliders. Identify missing or coupled motions before choosing the shared model.
2. Establish one consistent skeleton, body scale and coordinate system. If combining source models is necessary, explicitly adapt attachment frames, muscle paths, joint constraints and wrapping surfaces. Simply overlaying the current five bodies cannot establish interactions between them.
3. Validate the shared model through representative combined poses and repeated-pose checks. Test joints independently and together, check connections and movement directions, compare exported paths with native lengths, and verify that unaffected muscles stay unchanged. Retain unavailable-result handling.
4. Add the separate whole-body UI with bilateral control groups, per-joint and whole-pose reset, a shared reference, camera focus, and a searchable muscle list. Keep result feedback beside the controls. Preserve the regional workspaces during the model transition.
5. Treat neural mechanics as a separately evidenced extension. Do not fabricate a hamstring-length or tension response to ankle dorsiflexion to match a felt-stretch narrative.

The preceding interface cleanup removed practice workflows. The whole-body implementation below expands the exposed scope of the existing spine source without modifying its model or geometry files.


## Implemented model and controls

`biomechanics/wholebody.py` defines the adapter. `ModelEngine("wholebody")` reuses `models/spine/model.osim` and its verified geometry, with a separate calculation version and `wholebody__` muscle identifiers. It exposes all 598 muscle actuators and 130 nonempty mesh components; empty source mesh placeholders are skipped. Non-muscle actuators are excluded. Mesh identifiers use full component paths so left and right copies of the same file can be selected separately.

The public slider convention is degrees. Native knee flexion uses negative angles; both public knee sliders invert that sign. Left shoulder abduction and axial rotation are likewise sign-inverted for bilateral consistency. All other signs are preserved. Returned coordinates use the public slider convention; unexposed coordinates retain native units and source defaults. No native joint, attachment, wrap, constraint or geometry is changed.

| Controls | Count | Source interpretation |
| --- | ---: | --- |
| Head / neck | 3 | One head-and-neck body relative to T1; positive FE = extension, LB = right bend, AR = left turn |
| Thoracolumbar spine | 51 | 17 levels × FE/LB/AR; existing conservative per-level limits |
| Bilateral shoulders | 6 | Abduction, flexion/extension, internal/external rotation; source moving axes, fixed shoulder blades |
| Bilateral elbows | 2 | Flexion; visual bone motion only |
| Bilateral hips | 6 | Flexion, adduction, internal rotation positive |
| Bilateral knees | 2 | Flexion positive in UI |
| Bilateral ankles | 2 | Dorsiflexion positive |

The clavicle/scapula joints are welded in the source. Forearm and wrist coordinates are source-locked and remain unexposed. The cervical vertebrae are decorative geometry on the single moving head/neck body, not individually articulated joints. No muscle path attaches to the ulna, radius or hand; the model cannot teach elbow or wrist muscle behavior. The 46 lower-limb paths (23 per side) include biceps femoris, medial gastrocnemius, soleus and selected hip muscles, but omit semitendinosus, semimembranosus and other paths available in the regional lower-limb model. Regional controls remain available with their own source assumptions and references.

The new workspace reports native muscle–tendon path lengths. It does not calculate or display moment-arm actions, activation, fiber length, tension, nerve mechanics, contact or balance. The path export gate remains 1 mm. Slider combinations are not biological validation or safe-stretch recommendations.

## Interface and persistence

Movement Lab now offers Regional and Whole body. Each stays mounted after first use so toggling preserves live pose, reference and selection. The new workspace groups all controls in expandable regions; the right hip/knee/ankle groups start open. Resetting a group preserves all others. Camera focus does not change coordinates. Muscle search covers both sides and sorts by absolute change; anatomy references are reused only where an existing sided correspondence is available, with missing surfaces identified explicitly.

The whole-body viewer has explicit zoom-in/out buttons as well as mouse-wheel and two-finger controls. Front/Back/Side preserve zoom and the current focus; Whole body and camera reset fit the complete pose. Focus selected path fits the selected native route and follows it as joint angles change. Missing reference surfaces remain distinct from an available native path.

### Display layers — September 16, 2026

`src/wholeBodyDisplay.ts` reads family/side membership from the pinned spinal muscle inventory and explicitly groups the 46 lower-limb paths by native ID. Every one of the 598 paths has a family, side and display group. These are display groups, not exclusive dissection depth planes: Deep back, Abdominal wall, Rib muscles, Neck, Shoulders & upper back, Hip & thigh, and Lower leg. Intrinsic back families are separated from the shoulder-girdle families following the [UAMS back-muscle table](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-back-region/); cervical named families have their own Neck group. Psoas is grouped with Hip & thigh and quadratus lumborum with Abdominal wall. This organization does not change native anatomy, joint controls or calculations.

- **Selected muscle (default):** shows the selected family on the selected side. Right lumbar multifidus therefore shows 25 native paths instead of the entire 598-path network. One strand is emphasized; its own native length remains the numerical comparison. No whole-muscle average or aggregate length is invented.
- **Regional context:** adds explicitly enabled muscle groups, starting with the selected family’s group. The family stays included when its surrounding group is disabled. Other families are faint.
- **All paths:** explicitly enables the complete network and initially shows both sides. Side filters can then narrow it.
- **Side filters:** selected side, both sides, right or left. The highlighted strand remains visible even when its side is excluded from the surrounding context. This exception is stated in the controls.
- **Appearance:** whole-body lines use exact native polylines with fixed screen-space widths (4 px selected, 1.5 px same family, 1 px other context). Widths are display emphasis, not muscle diameters. Endpoint markers start hidden and use 7 px circles without perspective scaling. Bone opacity ranges from 0–100%; Bones only temporarily restores full opacity. Full-opacity bones occlude paths; fading them intentionally reveals paths behind them.

The visible-path set governs both rendering and pointer picking, including the screen-space fallback. Hidden and unavailable routes cannot be selected through invisible geometry. Display settings do not issue pose requests, clear slider values or alter saved references. Strand-versus-whole-muscle explanations appear beside the length result and above the resting atlas.

One saved reference uses `kinetic-wholebody-v1-reference`, containing its calculation version and pose request. On reload it is recalculated against the current native engine; incompatible or invalid references fall back to the starting pose with a notice. Storage failure leaves the reference usable for the session. Busy, failed and mismatched-version responses cannot be saved as references or presented as fresh comparisons. The selected result also appears beside the controls, including a sticky mobile readout.

## Validation

Run `.venv-opensim/bin/python biomechanics/validate_wholebody.py` or the full `npm run test:biomechanics` suite. The [machine-readable report](wholebody-validation.json) records 171 poses: the starting pose, both endpoints of every exposed coordinate, 24 deterministic randomized combined poses and two combined corner poses. All 102,258 native length comparisons match an independent unmodified source model exactly in this build. Maximum drawing/native difference is about 0.0191 mm; no tested path exceeds the 1 mm gate.

Checks also cover every achieved coordinate, source-default unexposed coordinates, all exported frame transforms, bilateral shoulder/hip/knee/ankle direction landmarks, head direction landmarks, repeated-pose independence and rejected locked/invalid inputs. Hip flexion lengthens the biceps-femoris long-head route; knee flexion shortens it and medial gastrocnemius while leaving soleus unchanged. Ankle dorsiflexion lengthens medial gastrocnemius and soleus, leaves biceps-femoris paths unchanged and leaves the opposite leg unchanged.

`tests/wholebody.spec.ts` checks combined sliders, shared-reference persistence, per-group and whole-body resets, view switching, search, camera focus, unique bilateral bone selection, responsive controls, unavailable anatomy, stale-version rejection and API range/lock rejection. These are software and source-agreement checks, not experimental validation of arbitrary whole-body poses.

`tests/wholebody-layers.spec.ts` checks all 598 grouping records against the source inventory, actual rendered family/side/group sets, stable display sizes while zooming, bone-opacity controls, hidden-path picking, unavailable-strand gating, unchanged pose requests while toggling layers, continued joint motion, mobile layout and keyboard/accessibility behavior. The display-layer change leaves the native model and calculation version unchanged.
