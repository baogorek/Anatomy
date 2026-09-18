# Longest-path search — September 18, 2026

## User behavior

In Regional or Whole body, select a muscle path and choose **Find longest path**.
The service searches the native muscle–tendon length, applies the longest
validated candidate found, and reports the before/after lengths. **Undo search**
restores the request from before the search. Saved references, camera orientation
and display layers are preserved.

**Joints to search** includes all exposed controls by default. Unchecked controls
retain their starting values. In the spine this includes all exposed spinal
levels, not just the current camera focus. Whole-body search optimizes the
selected strand, not an average of the displayed muscle family. The model's
unexposed and dependent coordinates retain the same defaults/coupling as normal
manual pose evaluation. Recorded shoulder tracks must be switched to manual
controls before searching.

Changing the pose, muscle, region or workspace cancels the search. Explicit
Cancel also leaves the current pose intact. A stale or mismatched response cannot
apply a pose. Search errors are separate from ordinary pose calculation errors.

## Numerical method

`biomechanics/longest_path.py` uses the pinned native engine; it introduces no
surrogate lengths, deformed mesh measurements or new optimization dependency.

1. Validate model version, selected muscle, bounds and chosen controls. Recompute
   the starting pose and require an available selected path.
2. Search from the current pose with coordinate-wise endpoint trials and smaller
   bounded steps. For up to six controls, also evaluate corners. Add 48 seeded
   interior samples and refine the best sampled starts. All trials use a fresh
   native state and the original model's assembly constraints.
3. Match the sliders' resolution: 0.5° for regional limbs/neck, 0.1° for spinal
   levels and 1° for other whole-body controls. Locked angles retain their exact
   starting values. Ties favor poses closer to the starting position.
4. Stop the exploration after 1,600 distinct candidates or 20 seconds, followed
   by final validation. Whole-body searches can use this full budget. It is not
   exhaustive and may miss other maxima.
5. Reject nonfinite results, failed assembly, paths with more than 1 mm drawing
   discrepancy and the known unreliable supinator pronation branch. Coordinate
   assembly tolerance is 0.001°, matching the existing MoBL audit (its coupled
   wrist residual is approximately 0.00055°).
6. Re-evaluate up to eight promising candidates with the regular pose engine.
   Check neighboring native paths at ±0.01° across every searched control;
   withhold a candidate with invalid neighbors or a length jump over 2 mm.
   Return the best passing candidate, with the starting pose as a fallback.
   A result never shortens the selected path relative to the search start.

The finite budget and starting points influence the result. The displayed
**Longest found within these limits** is an engineering search result, not a
proof of a global optimum. Lengthening this model's muscle–tendon route does not
measure muscle-fiber strain, passive force, pain, neural tension or a person's
safe joint combinations. The existing slider limits remain exploration limits.

## Service and concurrency

- `POST /api/biomechanics/longest-path` accepts `region`, `version`, `muscle`,
  `coordinates` and an optional nonempty `controls` list; returns a job id.
- `GET /api/biomechanics/longest-path/{id}` returns status, candidate count and,
  after successful completion, the verified result and pose.
- `DELETE /api/biomechanics/longest-path/{id}` requests cancellation.

One background search runs at a time. It shares the service's existing native
lock and releases it between evaluations so ordinary pose requests can run.
Model/state objects are never evaluated concurrently. Results are capped at
16 recent jobs, retained for at most ten minutes; old entries are pruned on job
creation. Cancellation is checked between native evaluations and before applying
results. The service health response identifies the solver revision so the dev
launcher detects an older backend.

## Verification

Run `npm run test:solver` for native checks covering all six models, repeat
calculation, bounds, coupled coordinate tolerances, left-side adapters, locked
controls, unavailable paths, cancellation and budget fallback. The neck check
recovers 111.0997 mm for the left anterior scalene from a 101.4209 mm starting
length while preserving upper-neck controls that do not improve that path.

`tests/longest-path.spec.ts` covers native application and Undo, saved reference
preservation, whole-body locks and layers, cancellation/stale responses after
pose/muscle/view changes, invalid API requests, concurrent pose responsiveness,
service failure, mobile layout and accessibility. This validates the software's
behavior and native consistency, not clinical effectiveness.
