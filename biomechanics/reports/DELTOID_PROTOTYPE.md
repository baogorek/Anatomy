# Deltoid visual prototype — September 10, 2026

**Decision: reject animated atlas surfaces; ship linked static anatomy and native moving mechanics.** The intended recognizable moving deltoid was not achieved. The app must not describe this result as muscle-surface animation or a realistic tissue simulation.

The trial extracted three right deltoid regions plus their atlas bones, attempted named-bone similarity registration, and guided surface deformation using native deltoid paths. Independent region deformation opened gaps; a shared field improved adjacency but flattened/collapsed the muscle bulk during elevation. Clearance projections and aggregate volume compensation produced ridges and wing-like shapes. Visual inspection at low, middle and high poses rejected these outputs. Neither nearest-bone registration error nor preserved total mesh volume established anatomical correctness. No face-level collision-free or tissue-strain claim is made.

The failed authoring code is retained as `biomechanics/authoring/rejected_surface_experiment.py`, with helper geometry and generated convex proxies. It writes only to the ignored `.playwright/deltoid/rejected/` directory. It is an experimental record, not part of the asset build. No experimental surface frames are served by the app.

## Delivered fallback

- Original atlas deltoid and shoulder bones in one view; the separate research model's bones and selected muscle path in the other. Region selection links the views, without spatial registration between bodies.
- Native 20–70° glenohumeral elevation in 2° steps, other coordinates at assembled defaults. No sampled-coordinate interpolation. The native multidimensional shoulder/hip/knee explorer remains available.
- Compare native path length with the 20° reference, play/pause, keyboard slider, region isolation, camera views, fullscreen, repeatable pose predictions and source details.
- No moving surfaces, fiber strain estimates, generic stretching colors or course-completion state.

## Reproduce

With Vite running and the existing GLB available:

```bash
node scripts/export-deltoid.mjs
.venv-opensim/bin/python biomechanics/authoring/build_study.py
.venv-opensim/bin/python biomechanics/authoring/check_study.py
npm test
npm run build
```

`deltoid-study-checks.json` records numerical results. The validator loads a fresh native instance and visits all 26 exported poses in reverse order. It compares all transforms, all three paths and lengths (78 compartment comparisons), checks path-polyline length agreement, and checks exact atlas vertices/topology. This supplements the existing native model validation; it does not expand its biological coverage.

## Next regional milestones

1. Shoulder: use this linked view for anatomy/action learning. A future moving surface needs authored attachment footprints, bone-compatible geometry and a deformation method reviewed across camera angles and motions. Do not expand a surface method that failed this one-muscle test.
2. Hip and knee: preserve the existing native controls; extend linked anatomy reference once compatible full lower-limb atlas assets are available. Evaluate rectus femoris and hamstrings while changing both hip and knee, rather than treating their lengths as a function of the hip alone.
3. Ankle: audit the existing lower-limb model's ankle/subtalar coordinates, geometry and muscle coverage before exposing controls. Include knee position for gastrocnemius and distinguish it from soleus. Test sign conventions, supported combinations and geometry/length agreement before adding lessons. Ankle controls are **not implemented**.

Hip display geometry still has the redistribution-license limitation documented in the main evidence report. This milestone does not resolve it.

## Browser and production verification

All 23 browser tests passed. After extending the small prediction loop to alternate raising/lowering and cycle through the three deltoid regions, its four focused tests passed again, including the reversed reference pose and region progression. TypeScript and the production build pass; Vite retains its existing large Three.js chunk advisory.

Production preview smoke checks confirmed the sampled study and live hip/knee explorer load without page errors. The final comparison was inspected at 70° from front, side and back; mobile fullscreen kept the elevation slider inside the viewport. The browser test also confirms that moving the model changes the mechanics canvas while leaving the atlas canvas unchanged. Automated WCAG A/AA checks passed for the new view at desktop and mobile widths; these do not replace manual accessibility review.
