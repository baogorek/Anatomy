# Ankle workspace

The ankle shares the original Lai–Uhlrich lower-limb model, live pose and saved reference with Hip and Knee. The API region remains `hip` for compatibility. Neither source model nor its checksum changed. Older saved references are re-evaluated to populate the newly exposed compartments.

## Controls and anatomy

- Ankle: −40° to +25°, positive dorsiflexion and negative plantarflexion.
- Subtalar: −15° to +20°, positive inversion and negative eversion.
- Knee and hip controls remain available. The toe coordinate stays at its default 0°.
- Original talus, combined heel/midfoot, and toe meshes extend the existing seven bone meshes to ten. The combined meshes are labeled as such. The ankle camera follows lower-leg motion; Focus joint follows the talus.
- All 40 right-leg muscle compartments are exposed. The 11 additions include both gastrocnemius heads, soleus, tibialis anterior/posterior, fibularis longus/brevis and the long toe flexors/extensors. All have resting atlas references; the exported atlas now contains 53 muscle/head regions and 52 contextual bone meshes, plus the existing separate TFL/IT-band dataset.

These are application exploration intervals. The source model uses an oblique pin axis at each of the ankle and subtalar joints, with rigid foot segments. It does not model ligament/contact mechanics or independent motion of every foot bone. Anatomical orientation follows [OpenStax joint anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints), [movement definitions](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), and [lower-limb muscles](https://openstax.org/books/anatomy-and-physiology/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs). Native coordinate signs are additionally checked against foot transforms and muscle moment arms.

## Learning and corrected calf geometry

Three explorations cover dorsiflexion/plantarflexion, knee-dependent calf lengths, and inversion/eversion. Six ankle predictions include both gastrocnemius heads, soleus, tibialis anterior and fibularis longus. Feedback comes from native evaluation and retains the 1 mm geometry gate.

The [cache investigation](GASTROCNEMIUS_CACHE.md) traced the earlier straight-knee failure to stale native wrap-point caches. The app now uses a pinned source-built package that invalidates those caches when a wrap point changes. Neither model anatomy nor the extraction algorithm or threshold changed. At rest, drawing errors are **0.0103 mm medial / 0.0080 mm lateral**, versus 8.736 / 7.269 mm in the original engine.

The calf exploration starts at **0° knee flexion and 20° dorsiflexion**. Save that reference, then bend only the knee to **90°**:

| Compartment | Length change |
|---|---:|
| Gastrocnemius medial head | −38.464 mm |
| Gastrocnemius lateral head | −40.605 mm |
| Soleus | Approximately 0 mm |

Saved reference requests are recalculated with the corrected engine. Older attempts remain in browser history, while current practice schedules only attempts with the current calculation version.

## Reproduction and checks

Run `npm run test:biomechanics`, `.venv-opensim/bin/python biomechanics/audit_sweeps.py`, and `npm test`. With the development server running, `node scripts/export-muscle-atlas.mjs` reproduces the atlas and `node scripts/audit-muscle-references.mjs` checks all 73 mappings.

- Native validation: 69 lower-limb poses across six exposed controls, 40 compartments and 2,760 independent native length comparisons; maximum discrepancy below 10⁻¹² mm. This is software agreement, not anatomical precision.
- Corrected-package calf audit: 1,015 poses per head, no drawings withheld, maximum errors 0.01821 / 0.01636 mm; 72 moment-arm/finite-difference checks have maximum error 0.02584 mm.
- Ankle/subtalar moment-arm signs agree with finite differences for soleus, tibialis anterior/posterior and fibularis longus.
- Additional assertions cover foot rotation signs, foot frame presence, fixed toes, calf comparison availability/direction, and rejection of invalid ankle/subtalar inputs.
- Continuity: 66 ankle and 36 subtalar samples at 1° steps, with maximum changes of 0.778 and 0.466 mm respectively. No steps exceeded the diagnostic 5 mm threshold. Combined positions are sampled, not exhaustively validated.
- All 35 browser tests pass. Ankle coverage includes entry, control order, talus selection/focus, preserved lower-limb pose/reference, native calf delta display, atlas reference, all six prediction prompts, mobile accessibility, old-reference migration, retained attempt history and mixed-build rejection.

Detailed results are in [validation.json](validation.json), [continuity.json](continuity.json), and [muscle-atlas-coverage.json](muscle-atlas-coverage.json).
