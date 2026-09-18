# Shoulder and lower-limb feasibility report

The local movement lab now uses native OpenSim geometry calculations, not deformation of the anatomy atlas. **Numerical reproduction succeeded within the tested scope. Biological validity of arbitrary stretch positions has not been established.**

Results are reproducible with `npm run test:biomechanics` and `.venv-opensim/bin/python biomechanics/audit_sweeps.py`. Exact results, source hashes and full test coordinates/lengths are in [validation.json](validation.json), [shoulder-poses.json](shoulder-poses.json), [hip-poses.json](hip-poses.json) and [continuity.json](continuity.json). Engine: source-built OpenSim `4.6+kinetic.wrapcache1`, pinned commit `85aaf6450a2f22457dac4d1ab35adfed9d3a8e43`, Python 3.12.3, Linux x86_64. Models were not edited.

## Native numerical agreement

The suite initializes a second model independently through the OpenSim API, applies the returned assembled coordinates, and compares `Muscle.getLength()` against the adapter's output. It includes defaults, each exposed control's endpoints/midpoint, 50 seeded combined poses per region, and 21 positions in each supplied shoulder track. It also revisits every pose after a reset to detect history-dependent results.

| Check | Shoulder | Hip/knee/ankle |
|---|---:|---:|
| Test poses | 123 | 69 |
| Compartments per pose | 33 | 40 |
| Independent native length comparisons | 4059 | 2760 |
| Largest native length discrepancy | 1.5543e-12 mm | 3.3307e-13 mm |
| Largest repeat-visit discrepancy | 0 mm | 0 mm |
| Largest requested/exposed coordinate discrepancy | 1.4211e-14° | 1.0793e-07° |
| Largest constraint residual | 4.5519e-13 | 0 |
| Largest accepted path-polyline discrepancy | 0.21796 mm | 0.030533 mm |
| Median pose calculation | 10.7 ms | 35.57 ms |
| Slowest in this run | 21.17 ms | 76.17 ms |

Very small native errors reflect software agreement at floating-point precision, **not anatomical measurement precision**. Unexposed shoulder coordinates remained fixed to numerical precision in manual mode. Unexposed unlocked hip-model coordinates outside the viewed limb moved by up to approximately 0.000546° during native assembly; dependent knee coordinates intentionally follow their coupling. Bone rotation determinants remained +1. Invalid names, nonfinite values, out-of-range values and unknown tracks were rejected.

The browser uses these native lengths directly, avoiding a multidimensional interpolation surrogate. Its integration test compares displayed millimeter deltas with API responses. This establishes transport/display agreement; it adds no independent anatomical evidence. Native service availability is required for movement calculations.

## Failures found and how they are handled

1. **Shoulder elbow unlock rejected.** The study package locks its elbow at 0°. An experimental property unlock followed by 90° elbow flexion produced approximately **−8.8 mm** for its triceps long-head path, an implausible response for teaching elbow extension/flexion. This was a diagnostic experiment only. The shipped model preserves the original lock, does not expose an elbow slider, and does not use elbow questions. Merely unlocking a coordinate does not make its muscle routing suitable for that motion.

2. **Native wrap-point cache defect corrected.** The original engine failed the drawing gate for several multiply-wrapped shoulder and gastroc paths. A targeted source fix invalidates inherited Point caches whenever a wrap point changes. The actual installed package now passes all drawings in the 123-shoulder/69-lower-limb pose suite. A separate 1,015-pose calf audit passes both heads with maximum drawing errors of 0.01821/0.01636 mm; 72 moment-arm/finite-difference checks have a maximum discrepancy of 0.02584 mm. Source models and the 1 mm gate remain unchanged. The browser still omits any failed drawing and comparison. See [the diagnosis](GASTROCNEMIUS_CACHE.md) and [installed-package results](gastrocnemius-installed.json).

3. **Two shoulder continuity flags remain.** The corrected engine's 363 single-coordinate shoulder samples at 1° steps found two steps exceeding 5 mm, both in inferior infraspinatus during the elevation-plane sweep: 5.791 mm from 43° to 44°, and 6.128 mm from 45° to 46°. Both adjacent drawings now pass the geometry gate, so consistency between drawing and native length does not establish route continuity. The original sweep reported larger jumps under the cache defect; that historical run is superseded by [the current data](continuity.json). Lower-limb sweeps (461 samples including ankle and subtalar controls) have no changes above 5 mm/degree (largest: 1.613 mm). The 5 mm probe is an engineering diagnostic, not a physiological limit. Combined poses and wrapping transitions outside these sweeps are not exhaustively covered.

4. **No automatic scapular rhythm.** Manual arm controls keep the three scapular control values fixed; the girdle sliders can change those values explicitly. Study tracks supply their own kinematics and are assembled by OpenSim. This prevents the app from silently inventing a shoulder-blade trajectory, but manual elevated-arm poses should not be interpreted as natural whole-arm movement.

## Anatomical evidence and spot checks

The shoulder model derives from a study that fitted muscle paths/moment arms to cadaver-based bounds and compared selected tasks in one participant. That scope does not validate personalized stretching or all arm-angle combinations. [Seth et al. (2019)](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00090/full)

The selected distribution is the subject-scaled model used by Belli and colleagues. Their study examined glenohumeral stability and reused experimental motion/EMG data; the distributed IK trajectories are model-estimated coordinates. Our app evaluates geometry only and does not run their stability/activation optimization. [Belli et al. (2023)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295003)

Cadaver experiments show regional and position-dependent shoulder moment arms; grouping an entire broad muscle into one invariant action is inadequate. Our checks retain separate deltoid/pectoralis/rotator-cuff compartments. No full numerical refit to that experimental dataset was performed here. [Ackland et al. (2008)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2644775/)

Lai and colleagues refined the preceding lower-limb model's knee routing and force properties for locomotor tasks involving substantial flexion. Their comparisons support that intended use more directly than arbitrary end-range stretches. The paper also discusses possible overestimation of gluteus maximus fiber-length change. We therefore report whole-path lengths without inferring fiber strain or passive tension. The selected Lai–Uhlrich derivative is not identical to the original 2017 file. [Lai et al. (2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5989715/), [author-hosted abstract](https://biewenerlab.oeb.harvard.edu/publications/why-are-antagonist-muscles-co-activated-my-simulation-musculoskeletal-model)

The following are **selected directional plausibility checks**, not validation of every compartment. Angles are 40° for shoulder/hip/knee and 10° for ankle/subtalar checks in the named coordinate; other coordinates are at model defaults. Native moment arms are compared with `−dL/dq` from ±0.01° length differences. Sign consistency links muscle-path length changes with the model's mechanical action.

| Compartment / coordinate | Native moment arm | Finite-difference value | Direction represented |
|---|---:|---:|---|
| Middle deltoid / shoulder elevation | +31.073 mm | +31.073 mm | Favors increasing GH elevation |
| Inferior pectoralis major / shoulder elevation | −19.416 mm | −19.248 mm | Favors decreasing GH elevation |
| Biceps femoris long head / hip flexion | −62.063 mm | −62.063 mm | Hip extension |
| Psoas / hip flexion | +29.893 mm | +29.893 mm | Hip flexion |
| Rectus femoris / knee flexion | −44.455 mm | −44.455 mm | Knee extension |
| Soleus / ankle | −38.265 mm | −38.265 mm | Plantarflexion |
| Tibialis anterior / ankle | +43.824 mm | +43.824 mm | Dorsiflexion |
| Tibialis posterior / subtalar | +16.656 mm | +16.656 mm | Inversion |
| Fibularis longus / subtalar | −23.622 mm | −23.622 mm | Eversion |

The pectoralis finite-difference discrepancy (about 0.168 mm of moment arm) is retained rather than rounded into an assertion of exact equality; wrapping numerical behavior differs from simple independent analytic paths. None of these checks measures muscle activation, perceived stretch, joint safety or person-specific accuracy.

## Browser and product verification

`npm run build` passes. All 35 browser integration tests pass, covering the existing atlas/learning/notes plus native movement, independent controls, saved-reference restoration, study playback, path unavailability, concealed quiz answers, full pose/version history, assistance tracking, stale-response rejection, service-error recovery, keyboard operation, fullscreen controls, mobile overflow and automated WCAG A/AA checks. Automated accessibility tests do not replace manual assistive-technology review.

The detailed atlas is preserved and the old custom shoulder deformation code is removed. Model-generated questions revisit concepts continuously; there are no completion counters. Native calculations are local. See [setup and provenance](../README.md) for the remaining separate hip display-geometry license question and the service deployment requirement.

The [ankle workspace report](ANKLE_WORKSPACE.md) records foot-transform checks, the restored straight-knee calf comparison, version migration and preserved geometry gate.

The [focused tibialis anterior audit](TIBIALIS_ANTERIOR.md) adds a source-point comparison, 314 pose checks and 98 length-derivative checks. It supports the basic dorsiflexion lesson but identifies a subtalar generalization limit and unvalidated endpoint-to-atlas correspondence. The interface now separates anatomical attachment descriptions from model endpoint segments. This audit does not certify all muscles or exact anatomical geometry.

## Elbow and wrist extension

The new workspaces use a separately pinned MoBL-ARMS source with two documented ECRL wrap-range changes, explicit supinator exclusions, and per-coordinate action consistency checks. See [source, anatomy scope and correctness limits](ARM_WORKSPACES.md) and [native audit results](arm-audit.json).

## Cervical workspace

The neck extension preserves a pinned Vasavada/Mortensen reference model, with separate upper/lower controls and 52 bilateral paths. See [source, anatomy coverage and limitations](NECK_WORKSPACE.md), including four explicitly missing semispinalis-capitis atlas references, and [the native audit](neck-audit.json).

## Recorded shoulder girdle workspace

The new right girdle workspace exposes the existing recorded shrug, abduction and flexion tracks. All 303 integer playback positions passed drawing, independent native-length, constraint and repeatability checks. Local ±0.01% progress probes found no changes above the 2 mm diagnostic threshold; this is not an exhaustive continuity proof. Four prediction signs were verified. Manual girdle controls now use a strict native solver to hold three scapular angles and solve the remaining girdle coordinates. A separate 292-pose audit verifies achieved angles, connection closure and native lengths. Isolated girdle moment-arm claims remain excluded because the native moment-arm solver does not use the slider-specific held coordinates. See [the scope and audit](SHOULDER_GIRDLE.md) and [machine-readable results](girdle-audit.json).
