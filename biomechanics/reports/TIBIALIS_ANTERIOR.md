# Tibialis anterior: correctness audit for learning

The evidence supports teaching the basic dorsiflexion/plantarflexion relationship with this path. It does **not** establish that its endpoint dots are precise anatomical landmarks, that it matches the orange atlas surface, or that all of its subtalar predictions apply to a human foot. This is a focused tibialis anterior audit, not certification of every muscle in the app.

## Attachments and the apparent mismatch

Cadaver dissection supports a broad origin on the upper lateral tibia and adjacent interosseous membrane, with regional differences in how far attachment extends distally. A single point cannot show this attachment area. [Kimata et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/)

The tendon usually inserts at the medial cuneiform and first metatarsal base, with variation in the division and size of its attachment bands. The model's single foot endpoint does not represent that entire insertion. [Olewnik et al., 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6359855/)

The app maps `tibant_r` to the named **Tibialis Anterior Muscle** atlas mesh. These remain different bodies, with independent camera fitting and no bone registration. Neither the correspondence by name nor the polyline check validates the atlas's exact attachment geometry.

All four local path-point definitions match [Rajagopal2016.osim at the pinned upstream commit](https://github.com/opensim-org/opensim-models/blob/d9b05d470b1a481c222372c85b75772faf8f7792/Models/Rajagopal/Rajagopal2016.osim). The recorded upstream file hash and extracted point definitions are in [the provenance record](../diagnostics/tibialis-anterior-source.json).

| Point | Rigid segment | Local position, metres |
|---|---|---|
| P1: proximal endpoint | tibia | (0.0154, −0.1312, 0.0162) |
| P2: routing point | tibia | (0.0251, −0.1906, 0.0128) |
| P3: routing point | tibia | (0.0233, −0.3659, −0.0132) |
| P4: distal endpoint | combined heel / foot | (0.1166, 0.0178, −0.0305) |

These are local-frame coordinates, not distances measured from a person's anatomical landmarks. The `calcn_r` segment includes tarsal/metatarsal bones; its name does not mean tibialis anterior attaches to the heel. There are no wrapping surfaces for this path. The gastroc cache defect does not explain this particular visual mismatch.

## Mechanical checks against the installed engine

Run `.venv-opensim/bin/python biomechanics/validate_tibialis_anterior.py` or `npm run test:biomechanics`. [Machine-readable results](tibialis-anterior-audit.json) retain the model/build identity and all sampled coordinates.

- 314 pose evaluations: 66 ankle samples and 36 subtalar samples at 1° steps, 112 combined ankle/subtalar grid poses, and 100 seeded combinations of all six controls. Some grid and sweep positions overlap.
- Four exported points agree with direct transformations of the source points at every sample. Maximum transport discrepancy: 0 mm. Maximum polyline/native-length discrepancy: 5.56 × 10⁻¹⁴ mm.
- All sampled ankle moment arms favor dorsiflexion; hip and knee moment arms are zero within numerical tolerance.
- 98 interior single-coordinate checks compare the native moment arm against `−dL/dq`, using ±0.01° perturbations. Maximum disagreement: 0.00000765 mm.

An isolated diagnostic moved P1 100 mm proximally **on the same tibia**, leaving P2–P4 unchanged. This added a constant 99.448 mm to total path length but changed no ankle moment arm or ankle-induced length difference in the five tested poses. This follows because P1–P2 and P2–P3 are fixed within the same rigid body; only P3–P4 changes with ankle/subtalar motion. Thus the upper dot's location cannot, by itself, validate or invalidate ankle leverage. This perturbation was not shipped, and the source model checksum is unchanged.

## Comparison with human measurements

With the subtalar coordinate at zero, the current model gives:

| Ankle pose | Dorsiflexion moment arm | Whole-path length |
|---|---:|---:|
| 40° plantarflexion | 31.53 mm | 332.21 mm |
| 30° plantarflexion | 34.98 mm | 326.40 mm |
| Neutral | 42.61 mm | 305.87 mm |
| 15° dorsiflexion | 44.05 mm | 294.48 mm |
| 25° dorsiflexion | 43.48 mm | 286.82 mm |

MRI/ultrasound estimates at rest reported a moment arm declining from approximately 45 to 29 mm when moving from dorsiflexion to plantarflexion. The model has a similar scale and broad trend, but this is **not** a matched-angle curve fit or an error-bound validation. [Maganaris, 2000](https://pubmed.ncbi.nlm.nih.gov/10673122/)

A separate five-man study reported a neutral moment arm of 36 ± 4 mm. The model's 42.61 mm is approximately 18% above that reported mean. Differences in anatomy, joint-axis definitions and measurement protocols prevent interpreting this directly as an 18% model error; they also prevent claiming exact agreement. [Maganaris and Paul, 1999](https://physoc.onlinelibrary.wiley.com/doi/10.1111/j.1469-7793.1999.00307.x)

**Subtalar limitation:** at a neutral ankle, this model predicts an inversion moment arm from +6.70 mm at 15° eversion to +11.23 mm at 20° inversion. In ten healthy subjects, ultrasound-based measurements found tibialis anterior could exert an eversion moment in an everted foot, with increasing inversion leverage as the foot inverted. The model does not reproduce that reported change of action within our sweep. The study's frontal-plane foot angle and this model's oblique subtalar coordinate are not interchangeable, so this is a limitation in generalizing the model, not a calibrated point-for-point error estimate. [Lee and Piazza, 2008](https://pubmed.ncbi.nlm.nih.gov/19019375/)

## What upstream validation establishes

Rajagopal's model represents muscles as massless lines of action and tested gait simulations and selected moment arms against experiments. Its published ankle test interval includes the app's sagittal range. The authors also identify limitations of one-dimensional paths and recommend checking them for the intended use. These results support using the model as a mechanics approximation; they do not validate an atlas overlay or every combination of joint positions. This audit verified inherited point definitions, not equivalence of the entire current model to the publication's model. [Rajagopal et al., 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5507211/)

## Corrections in the learning interface

- Replaced “Attachments on the model” with **Model endpoint segments** throughout the movement lab. Added an explanation that dots identify endpoints rather than entire anatomical attachment regions.
- Added sourced origin/insertion descriptions for tibialis anterior and its basic action, with evidence and the subtalar limitation beside its calculations.
- Stated that the atlas's attachment areas are not aligned to the native model's endpoints.
- Concealed action/evidence text during unanswered predictions so it does not reveal the answer. The existing plantarflexion prediction remains supported.

The source paths were not reshaped to match a different body. Exact anatomical registration would require matched bone landmarks and attachment data; a universal subtalar action claim would require stronger model validation or a revised model. Neither is established by these software checks. Existing shoulder continuity flags and other project limitations remain in [EVIDENCE.md](EVIDENCE.md).

Verification: production build passed; all 36 browser cases passed across the full suite and a targeted rerun after correcting the new test's accessibility selector. Coverage includes the new attachment/evidence display, concealed quiz answers, desktop/mobile layout and automated WCAG checks. All 96 pinned asset checksums passed. The preview at port 4173 serves the rebuilt interface and the verified native service.
