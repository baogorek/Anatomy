# SplineFitness — Movement Lab

An interactive anatomy and movement workspace for personal trainers. Built with React, TypeScript, Vite, and Three.js.

This Anatomy repository is a standalone local tool, separate from `~/devl/SplineFitness`. The SplineFitness branding and full citations are retained. Integration with the fitness app and public hosting were cancelled; the [archived deployment notes](docs/SPLINEFITNESS_DEPLOYMENT.md) record that earlier work, not an active deployment plan.

The **Movement lab** uses native OpenSim models for joint motion and muscle–tendon length comparisons. See [setup, model provenance and assumptions](biomechanics/README.md), [validation and evidence](biomechanics/reports/EVIDENCE.md), and the [original plan with implementation decisions](OPENSIM_PLAN.md).

## Run locally

Requires Node.js 22.12+ (tested on Node 24), Python 3.12 and an OpenSim-compatible platform (tested on Linux x86_64).

```bash
npm install
npm run setup:biomechanics
npm run dev
```

Setup downloads 81 checksum-pinned hip display meshes directly from their recorded upstream source. Those local files are excluded from Git because their individual redistribution terms remain unresolved. Other bundled datasets retain their own license and attribution notices; MoBL-ARMS includes a non-commercial condition. See [model licensing](biomechanics/README.md#attribution-and-licensing).

Open the URL printed by Vite (normally http://localhost:5173).

### What runs on your computer

`npm run dev` starts both parts of the app automatically:

- **Browser interface (JavaScript/TypeScript):** Vite serves the 3D viewer and controls at http://localhost:5173.
- **Calculation backend (Python/OpenSim):** runs at http://127.0.0.1:8765 and calculates joint positions, muscle–tendon path lengths and longest-path searches. The browser sends requests to it through Vite.

You do **not** need to start Python separately. The launcher reuses a compatible backend if one is already running. Keep `npm run dev` running while using the lab. All movement calculations run on your computer; no cloud backend or hosting account is required. `npm run preview` also starts the local Python backend.

The static anatomy viewer can display without Python, but live joint calculations and the longest-path solver require the backend.

```bash
npm run build       # Type-check and generate dist/
npm run preview     # Serve the production build
npm test            # Browser integration tests
npm run test:biomechanics  # Native model checks
```

For a fresh test environment, first run `npx playwright install chromium`.

## What is included

**Movement lab is the home screen.** Move joint sliders, inspect muscle–tendon paths and compare lengths. The separate Explore, My notes and quiz areas have been removed. Existing browser notes and learning records remain untouched; saved movement references remain available.

### Movement lab

- In **Regional**, choose **Neck**, **Spine**, **Shoulder**, **Elbow**, **Wrist**, **Hip**, **Knee**, or **Ankle**. Move the sliders, click a path or choose a muscle from the searchable list, and compare its length with a reference pose. A compact mobile readout keeps the selected result beside the controls.
- **Spine group controls** move the entire modeled spine (T1–S1), thoracic spine (T1–L1), or lumbar spine (L1–S1) with three sliders: flexion/extension, side bending and rotation. Changes are shared across the selected joints within each joint’s existing limits. **Fine-tune individual joints** retains local adjustments. Totals are summed joint-angle changes, not measured torso angles. Whole body provides the same grouped controls in its Lumbar spine and Thoracic spine sections.
- Hip, knee, ankle and subtalar controls share one lower-limb pose. Elbow, forearm and wrist controls share one arm pose. Switching focus within either group preserves its pose and reference. The other workspaces use separate models.
- **Save current as reference** compares subsequent positions with that pose. Saved references survive reload and are recalculated against the current native engine.
- **Find longest path** searches the selected path in Regional and Whole body, applies the longest validated pose found, and provides **Undo search**. Under **Joints to search**, uncheck controls to hold their current angles. Search uses the existing slider bounds and resolution; saved references and display layers are preserved. Changing the pose, path or workspace cancels an in-flight search. Use manual controls rather than a recorded movement. This is a bounded geometry search, not a guaranteed global maximum or a safe-stretch recommendation. See [solver behavior and validation](biomechanics/reports/LONGEST_PATH_SEARCH.md).
- **Spine muscle context** starts with bilateral deep-back paths (164 at the starting pose). Switch to Selected muscle or All paths, or choose additional groups in Layer settings. Single-path isolation is opt-in; Show muscle context restores the display. Line widths stay narrow as you zoom, with adjustable bone opacity and optional endpoint markers.
- **Bones only**, bone selection, **Focus joint**, camera orientation, isolation and fullscreen support close inspection. Shoulder also offers **Focus scapula** and **Whole shoulder**; spine offers **Whole spine**.
- **Example poses & joint anatomy** is an optional collapsed section. Recorded shoulder movements remain available in the Movement selector with playback and a progress slider.
- Selecting a muscle opens its resting atlas anatomy beside the native bones and force path. The atlas retains its original geometry. Compartment-to-broader-muscle matches and missing reference surfaces are labeled. Muscle and iliotibial-tract visibility are separate for tensor fasciae latae.
- **Deltoid close-up** remains an optional shoulder view, with resting atlas anatomy beside sampled native mechanics and an elevation slider. It has no quiz. The sampled close-up works without the native service; live joint calculations require that service.

Colors describe modeled **muscle–tendon length change**. They do not calculate activation, tissue tension, muscle-fiber strain, felt stretch, or safe range of motion. Endpoint dots mark simplified force-path ends, not full anatomical attachment areas. A failed geometry or applicable consistency check makes the affected result unavailable.

The regional evidence and limitations are documented in the [shoulder-girdle audit](biomechanics/reports/SHOULDER_GIRDLE.md), [arm audit](biomechanics/reports/ARM_WORKSPACES.md), [neck audit](biomechanics/reports/NECK_WORKSPACE.md), [spine audit](biomechanics/reports/SPINE_WORKSPACE.md), [gastrocnemius audit](biomechanics/reports/GASTROCNEMIUS_CACHE.md), and [tibialis-anterior audit](biomechanics/reports/TIBIALIS_ANTERIOR.md). The spine exposes 17 intervertebral levels and 552 source upper-body fascicles; missing native deep muscles have a separate resting-atlas collection without fabricated motion results.

### Anatomy reference, inside Movement Lab

**Anatomy reference** opens a searchable catalog of all 222 named muscle-tagged structures in the bundled atlas, including the lower body that Explore previously clipped out. Names include heads, parts and some tendons; this is not a count of distinct muscles. Select any shape, rotate and zoom it, choose a side, or reveal surrounding muscles. The original guided entries retain their attachment/action summaries.

- **Modeled:** 102 named atlas structures have verified anatomical links to exposed native paths. Choose a labeled path and open its regional or whole-body workspace. Links describe anatomical correspondence, not surface registration, full-muscle coverage or matching subject anatomy. Sides and compartments are explicit.
- **Anatomy only:** 120 named structures have no verified link to an exposed movement path in this app. They remain inspectable without fabricated length calculations. This label does not mean no OpenSim source could model them.
- Catalog coverage is independent of service availability. Opening and closing the reference preserves the current pose and saved reference; playback/search stop while browsing. Explicitly opening a different model uses that workspace's own pose/reference behavior.
- Regenerate the versioned inventory with `node scripts/build-anatomy-catalog.mjs` while the studio is running. The file records the atlas checksum and source-model versions. Browser checks verify catalog links against the exposed source configurations. See [catalog scope and checks](biomechanics/reports/ANATOMY_CATALOG.md).

### Whole-body option

Choose **Movement lab → Whole body** for a connected Bruno / Bern skeleton, 598 muscle paths and 72 native joint coordinates organized by side and region. Combine hip, knee, ankle, shoulder, elbow, head and grouped or individual spinal angles in one pose. Save one reference for the entire body, reset a region or the whole pose, search muscle changes, and focus the camera without resetting other joints. Switching between Regional and Whole body preserves each view's live state.

The default **Selected muscle** view shows the selected muscle’s modeled strands on its side of the body. **Regional context** adds optional muscle groups; **All paths** exposes the complete network. **Layer settings** provides side filters, bone opacity and small optional attachment markers. Lines and markers stay narrow as you zoom. The emphasized strand owns the length readout; the resting atlas shows the broader muscle anatomy. Changing display layers preserves the pose and saved reference.

Coverage follows the source: head and neck form one moving segment, scapulae and wrist/forearm joints stay fixed relative to their parent segments, and elbow motion has no elbow/forearm muscle paths. The model includes a subset of leg muscles. This is geometric exploration, with no neural or tissue-tension simulation. See the [whole-body source, coordinate signs, validation and ankle–hamstring fact-check](biomechanics/reports/WHOLE_BODY_DIRECTION.md).

The app stores reference poses in the browser and sends joint coordinates to its OpenSim service through `/api/biomechanics`. `npm run dev` and `npm run preview` start a local service automatically. Serving `dist/` alone supports the atlas and sampled deltoid view, but does not provide live joint calculations.

## Anatomy and learning references

Original educational summaries refer to [OpenStax upper-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [OpenStax body movements](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), StatPearls ([shoulder muscles](https://www.ncbi.nlm.nih.gov/books/NBK534836/), [deltoid](https://www.ncbi.nlm.nih.gov/books/NBK537056/), [rotator cuff](https://www.ncbi.nlm.nih.gov/books/NBK441844/)), [AAOS shoulder conditioning](https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/), and [Mayo Clinic stretching principles](https://www.mayoclinic.org/healthy-lifestyle/fitness/basics/stretching-and-flexibility/hlv-20049447). Sources are also linked inside the app.

The exercise examples are educational, not individualized rehabilitation programs. The anatomy model is a simplified reference; it does not represent a user's anatomy or range of motion.

## Model attribution

The app’s **Sources & model credits** link opens the [complete browser-readable credits](public/credits/index.html). Each regional model and Whole body also links to its own section under model evidence. The page includes the 12 model/engine publications, original projects and pinned researcher sources, local modifications, full preserved notices, a downloadable RIS bibliography and exact version/checksum records. It works without the native service.

`npm run credits` regenerates the public bundle from `credits/catalog.json`, `credits/publications.json`, the pinned model/runtime manifests, `src/learningSources.json` and preserved notices. Both `npm run dev` and `npm run build` regenerate it automatically. `node scripts/build-credits.mjs --check` checks for stale generated files. See [credit maintenance and provenance](credits/README.md).

The model uses **Z-Anatomy** by Gauthier Kervyn, derived from **BodyParts3D**, © The Database Center for Life Science. The compressed browser model was prepared by [hpfrei](https://github.com/hpfrei/body-anatomy-3d-viewer). Unused descriptive metadata was removed locally, reducing the download from 8.2 MB to 2.2 MB without changing geometry. Material colors, clipping, and layer visibility are applied by the viewer.

The adapted model remains licensed under **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. See [full model attribution](public/models/ATTRIBUTION.md). The locally bundled Draco decoder is Apache 2.0 licensed. Model licensing applies to the model asset; the application code was written independently.

All anatomy and decoder assets are served locally. The interface fonts currently load from Google Fonts, with system-font fallbacks. No user notes or learning history are transmitted by the app.

### Reproduce and audit muscle references

With Vite running on port 5173, `node scripts/export-muscle-atlas.mjs` extracts the bundled Z-Anatomy surfaces. `python3 scripts/export-tfl-reference.py` converts the preserved original TFL/IT-band subset without fitting or deformation. `node scripts/audit-muscle-references.mjs` checks all 142 native paths (138 mapped references and four declared missing neck surfaces) and exported mesh indices and writes the coverage report. See [TFL source verification](biomechanics/reports/TFL_REFERENCE.md) and the per-dataset [reference credits](public/models/muscle-reference/ATTRIBUTION.md).
