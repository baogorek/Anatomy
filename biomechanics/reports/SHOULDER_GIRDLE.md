# Scapular controls in the Shoulder workspace

The unified Shoulder workspace uses the existing, unmodified Seth / Belli shoulder model and its three supplied movement files. Arm and scapular controls use one pose and saved reference. The redundant Shoulder girdle tab has been removed; its movement examples and prediction IDs are retained in Shoulder. The source model and right-side anatomy are unchanged. Three existing scapular coordinates are now independently controlled; the remaining girdle coordinates are solved natively.

## Learning view

- Default posterior view; right scapula highlighted green and clavicle gold, with the thorax translucent for context. Focus scapula follows the moving scapula; Whole shoulder frames the arm and trunk together.
- Recorded shrug, arm abduction and forward elevation, with playback and 0–100% scrubbing. The forward-raise exploration includes motion around the thorax, but is explicitly not an isolated protraction/retraction test.
- Featured comparisons cover superior/middle/inferior trapezius, serratus anterior, rhomboids, levator scapulae and pectoralis minor. All 33 existing shoulder compartments remain inspectable with their separate resting atlas references.
- Six actual assembled scapular/clavicular angles plus humeral elevation relative to the scapula, with changes from the current reference. These source-model angles are not clinical measurements, and must not simply be added to estimate total arm elevation.
- Four audited predictions, using the model starting pose as reference. A recording's first sample is not necessarily the model starting pose. Selecting an exploration resets the comparison reference to the model starting pose, as in the other workspaces; switching workspaces preserves the current reference.

The tracks are inverse-kinematics estimates from study data, subsequently assembled to satisfy the AC joint constraint. They are not direct measurements of every bone or a universal scapulohumeral rhythm. Sources: [Seth et al. (2019)](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00090/full), [Belli et al. (2023)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295003). Original pins, licenses and attribution remain in the model manifest and package.

## Manual girdle controls

The workspace presents the three arm controls followed by the three scapular controls, using anatomical names without axis badges. Manual examples cover protraction, elevation and upward rotation. Focus joint, Focus scapula and Whole shoulder preserve all six control values and the shared reference when changing the camera.

| Control | Range | Increasing values |
| --- | --- | --- |
| `scapula_abduction` | −30° to 5° | Protraction around the thorax |
| `scapula_elevation` | −10° to 10° | Scapular elevation |
| `scapula_upward_rot` | 0° to 45° | Upward rotation |

These are model-coordinate exploration limits, not clinical range measurements. The native AC point constraint connects the clavicle and scapula. A fresh `AssemblySolver` locks the three requested scapular coordinates in its temporary state and solves `clav_prot`, `clav_elev` and `scapula_winging`, with infinite constraint weight. The returned angles and constraint residual are explicitly checked; infeasible assembly is rejected. The source model's properties and files remain unchanged.

The initial generic `Model.assemble()` probe redistributed a +10° elevation input to about +4°, motivating the explicit solver. Its cached assembly conditions do not automatically reflect changed state locks, and its fallback may relax constraints. The new solver avoids both behaviors. Every evaluation starts from the same source state for repeatability.

The native moment-arm routine also retains its own state and only copies pose coordinates; its girdle coupling does not represent this slider-specific set of held angles. Therefore its raw values are retained for diagnostics but girdle moment-arm actions are marked unavailable and are not taught in the UI. Lengths and displayed paths are still evaluated natively at the fully assembled pose. Local ±0.01° native-length probes detect jumps near each manual pose; the existing 1 mm drawing gate remains enforced. Existing arm-coordinate moment arms are checked against local length derivatives before display. The calculation adapter version is now `kinetic-geometry-v3`, so saved references are recalculated and old attempts stay historical.

### Manual-control audit

[validate_girdle_controls.py](../validate_girdle_controls.py) and [girdle-controls-audit.json](girdle-controls-audit.json) cover 292 poses: one-degree single-control sweeps, all eight girdle range corners and 180 seeded combined arm/girdle poses, plus direction and example checks.

- 9,636 independent native length comparisons; maximum discrepancy 1.32 × 10⁻¹² mm.
- Maximum requested/achieved angle discrepancy 1.43 × 10⁻¹⁴ degrees.
- Maximum constraint residual 9.81 × 10⁻¹²; maximum drawing discrepancy 0.83407 mm.
- No withheld paths in this audit; no repeat-pose length discrepancy.
- Landmark checks confirm anterior motion for increasing protraction, superior motion for increasing elevation, and lateral swing of the actual scapular mesh's inferior tip during upward rotation.
- Six example length-change signs are verified, including serratus shortening with protraction and levator shortening with elevation.

These numerical results do not establish person-specific anatomical accuracy or exhaustive continuity. Girdle moment-arm claims remain excluded for the reason above.

## Native audit

Run `.venv-opensim/bin/python biomechanics/validate_girdle.py`; results are in [girdle-audit.json](girdle-audit.json). The command is also included in `npm run test:biomechanics`.

| Check | Result |
| --- | --- |
| Playback poses | 303 (every integer percentage in all three tracks) |
| Independent native muscle-length comparisons | 9,999 |
| Maximum native length discrepancy | 1.06 × 10⁻¹² mm |
| Maximum drawing/native length discrepancy | 0.21818 mm (1 mm gate) |
| Maximum AC constraint residual | 7.06 × 10⁻¹² |
| Maximum repeat-pose length discrepancy | 0 mm |
| Local probes | ±0.01 percentage point at all 303 playback positions, one-sided at endpoints |
| Largest local change in the 11 girdle paths | 0.32711 mm (2 mm diagnostic threshold) |
| Withheld paths / flagged local non-girdle jumps | None in this audit |

The audit checks finite lengths, unchanged model hash, degree conversion, rigid bone rotations, constraint closure, repeatability after intervening poses and all four prediction signs. Local probes follow each supplied recording; they are not independent-coordinate moment-arm tests. Passing this finite sample does not establish continuous or person-specific anatomical accuracy. Existing limitations of manual shoulder paths remain documented in [EVIDENCE.md](EVIDENCE.md).
