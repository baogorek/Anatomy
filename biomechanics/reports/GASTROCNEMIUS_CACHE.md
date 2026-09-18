# Gastrocnemius: geometry-check failure and tested remedy

The straight-knee limitation has a reproducible software cause in the original
OpenSim 4.6 build (`85aaf64`): wrap-point local positions are updated during
wrapping, while inherited world-position caches can retain earlier positions.
Invalidating those caches after every local update removes the inconsistency in
the diagnostic tests below. This finding supersedes the earlier description of
an unexplained drawing discrepancy. **The app now uses the source-built `4.6+kinetic.wrapcache1` package.** The original diagnostic results below are preserved; [installed-package regression results](gastrocnemius-installed.json) record the actual shipped engine separately.

## What the check actually measures

The app compares the summed lengths of its exported drawing segments with native
`Muscle.getLength()`. If they differ by more than 1 mm, it withholds the drawing
and comparisons involving that pose. The threshold is an engineering consistency
check, not a biological accuracy claim. At the stock straight-knee starting pose,
the disagreement is 8.736 mm for the medial head and 7.269 mm for the lateral head.

Initially this was described as a drawing problem. The diagnostic shows that the
native length and some moment-arm results are affected too. Native-to-native
agreement in the original validation could not reveal a defect shared by both
copies of the same engine.

## Evidence for the cause

In the original source, [`PathWrapPoint::setLocation`](https://github.com/opensim-org/opensim-core/blob/85aaf64/OpenSim/Simulation/Wrap/PathWrapPoint.cpp)
updates `wrap_location`. The inherited [`Point::getLocationInGround`](https://github.com/opensim-org/opensim-core/blob/85aaf64/OpenSim/Simulation/Model/Point.cpp)
uses a separate `location` cache. The setter does not invalidate that cache.
[`GeometryPath`](https://github.com/opensim-org/opensim-core/blob/85aaf64/OpenSim/Simulation/Model/GeometryPath.cpp)
consults world positions while iterating over multiple wrapping surfaces and when
combining straight distances with stored curved lengths.

For the medial gastrocnemius at rest, one cached point differs from its directly
transformed local position by **8.421 mm**. Its shank-wrap segment has a cached
endpoint-to-endpoint distance of **45.343 mm**, but a native curved length of only
**38.049 mm**. A curve cannot be shorter than the straight distance between its
own endpoints: these values describe inconsistent iterations of the geometry.

Clearing caches only after a complete evaluation and asking the engine to
recalculate reproduces the issue inside the next wrapping iteration. The fix must
run when each wrap point changes, during the native calculation.

## Tested source fix

The [source patch](../diagnostics/wrap-cache/opensim-85aaf64-wrap-cache.patch)
invalidates the inherited `location`, `velocity`, and `acceleration` caches in
`PathWrapPoint::setLocation`, immediately after setting the new local position.
Model origins, insertions, wrapping surfaces, and the 1 mm gate remain unchanged.

The initial behavior was tested using a temporary Linux interposer around the actual native setter. The app now uses a complete source build of the pinned OpenSim commit with that patch. No interposer is used by the service or installed-package tests. The wheel includes build provenance and license notices; [runtime-manifest.json](../runtime-manifest.json) records its checksum and native binary identity.

| Check | Stock engine | Cache invalidation probe |
|---|---:|---:|
| Medial drawing error at rest | 8.736 mm | 0.0103 mm |
| Lateral drawing error at rest | 7.269 mm | 0.0080 mm |
| Medial rejected poses, out of 1,015 | 366 | 0 |
| Lateral rejected poses, out of 1,015 | 263 | 0 |
| Largest medial drawing error | 8.808 mm | 0.0182 mm |
| Largest lateral drawing error | 7.363 mm | 0.0164 mm |
| Largest moment-arm versus finite-difference discrepancy | 16.527 mm | 0.0258 mm |
| Repeat-visit length discrepancy | 0 mm | 0 mm |

The actual source-built package independently reproduces these corrected results: zero withheld gastroc drawings in 1,015 poses, maximum errors 0.01821 / 0.01636 mm, and maximum moment-arm discrepancy 0.02584 mm. All 35 browser tests and the production build pass. The current continuity sweep retains two shoulder flags, documented in [EVIDENCE.md](EVIDENCE.md); the cache fix does not establish global path continuity.

The pose set includes 915 knee/ankle/subtalar grid positions and 100 seeded
combinations of all six lower-limb controls. There are 72 moment-arm comparisons
against `−dL/dq`, using ±0.01° perturbations. The corrected cached points agree
with directly transformed local points throughout the sampled poses.

At a neutral ankle, bending the knee from 0° to 90° changes the corrected native
length by **−38.437 mm medial / −40.623 mm lateral**. These are model outputs,
not measurements of a person's calf. The stock engine gives substantially smaller
changes, which is why simply allowing its current numbers through the drawing
gate would be an inadequate remedy.

The existing full native validation also passes under the diagnostic patch:
123 shoulder poses and 69 lower-limb poses, independent native length comparisons,
repeatability, constraints, selected actions, and the existing ankle checks.
No drawings fail the gate in that sampled full-suite run, including shoulder
paths previously withheld. This is engineering evidence, not validation of all
anatomical routes or continuous joint combinations.

## Application integration

The corrected wheel is bundled locally and verified during setup and service startup. Its native identity contributes to each calculation version alongside the immutable model checksum and adapter version. The browser recalculates saved reference requests, preserves older attempts without using them for current-version scheduling, and rejects responses from a different calculation version.

The calf exploration now compares a straight knee with 90° knee flexion at 20° ankle dorsiflexion. The actual installed package reports **−38.464 mm medial / −40.605 mm lateral**, with soleus unchanged to numerical precision. Two additional ankle predictions directly cover gastroc dorsiflexion and knee dependence. The original geometry gate remains active, with explicit browser regression coverage for unavailable paths.

`npm run test:biomechanics` checks the installed native package, including the full shoulder/lower-limb suite and the same 1,015-pose/72-action calf audit. `npm test` checks application behavior and migration; `scripts/build-opensim.sh` reproduces the native build.

The [diagnostic instructions](../diagnostics/wrap-cache/README.md) reproduce the
comparison. [Recorded results](gastrocnemius-wrap-cache.json) include model/library
hashes, individual moment-arm checks, and the isolated full-suite native report.
