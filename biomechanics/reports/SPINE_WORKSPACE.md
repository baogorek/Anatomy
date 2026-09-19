# Thoracolumbar spine workspace

The Spine tab exposes the **17 existing intervertebral joints from T1–T2 through L5–S1**, with grouped controls and optional three-axis fine tuning for a selected level. Changing levels preserves all other angles. There are 552 bilateral upper-body muscle–tendon fascicles available for inspection, including all source multifidus and intercostal fascicles. The default view shows bilateral deep-back context (164 paths at the starting pose). Layer settings selects other groups or all paths; single-path isolation is opt-in. **Focus joint** follows the selected vertebral level; **Whole spine** restores an overview.

## Source and provenance

- Original model: Bruno, Bouxsein and Anderson, *Development and Validation of a Musculoskeletal Model of the Fully Articulated Thoracolumbar Spine and Rib Cage* (2015), [doi:10.1115/1.4030408](https://doi.org/10.1115/1.4030408), [paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC5101035/).
- Original project: [Thoracolumbar Spine and Rib Cage](https://simtk.org/projects/spine_ribcage). Its download listing specifies MIT, copyright 2015 Stanford University; the complete displayed notice is preserved in `models/spine/LICENSE.txt`. This is the source project's notice, not an inferred repository-wide license for the mirror.
- Retrieved template: [`bern-movement-lab/tlsm`](https://github.com/bern-movement-lab/tlsm/tree/0ad72fa2565155f125b3120c37174132708d0130), commit `0ad72fa2565155f125b3120c37174132708d0130`, `+tlsm/@ModelBuilder/Templates/MaleFullBody_v11_LTpT_T12Fix.osim` and its 130 matching geometry files.
- Model SHA-256: `57fda207201b5137dd11c0779dd0a5532ec68d5222a9a950e88d60f8c6262f43`.
- No source model or geometry edits. The mirror's version and named LTpT/T12 fix are retained. The SimTK archive requires login; **byte identity with that archive is not asserted**. The independent audit loads the same preserved researcher template separately.
- `models/manifest.json` pins origin and hash. `models/checksums.json` pins every source asset and the curated muscle naming inventory.

## Controls and scope

| Native suffix | Slider | Positive direction | Application interval |
| --- | --- | --- | --- |
| FE | Flexion / extension | Extension | −3° to +3° per joint |
| LB | Right / left lateral flexion | Right | −2° to +2° per joint |
| AR | Left / right axial rotation | Left | −1° to +1° per joint |

The signs were checked against native body transforms. Individual controls display **native joint coordinates**; grouped controls display their summed changes from the starting pose. Neither readout is a whole-trunk Euler angle, measured clinical range of motion, or safe limit. No universal lumbar/thoracic rhythm is imposed. The multi-joint exploration deliberately applies equal 3° flexion at five lumbar joints and labels that as an illustrative pose. Users can adjust each level independently.

All unexposed coordinates retain their initialized defaults, including pelvis, hips, abdominal routing body, rib joints, sternum and upper limbs. Ribs follow their parent vertebrae. The model does not deform costal cartilage or simulate breathing. Its abdomen is a routing representation, not a deforming abdominal wall. This simple boundary condition must be considered when interpreting abdominal and intercostal paths, especially combined spine poses. Lumbar and thoracic bones are articulated; the head and neck in this template are lumped. The Neck tab uses a separate cervical model.

The selected joint determines which three moment arms are computed and locally checked. `spineLevel` is a presentation/calculation selection in requests; it does not change joint angles. All 51 angles can be supplied together. Native muscle IDs are namespaced as `spine__<native ID>` in the browser to avoid collisions with different neck/arm source models. `models/spine/muscles.json` records the original IDs and endpoint bodies.

## Grouped spine controls

Regional Spine defaults to three group sliders for all 17 modeled joints (T1–S1), with selectors for the 12 thoracic joints (T1–L1) or five lumbar joints (L1–S1). Whole body exposes the same sliders within its lumbar and thoracic sections. Individual controls remain available under **Fine-tune individual joints**. Opening that section or switching groups does not change the pose.

Each group slider represents the sum of its joint-angle changes from their configured defaults. The frontend solves for a shared offset added to the current angles, clamping each joint to its existing bound. Joints at a bound stop; the remaining joints share the rest of the requested change. Existing differences between joint angles are preserved while those joints remain away from their limits. This is an editing convenience, not a new physiological coupling or distribution model. Reversing after saturation need not recover previous fine adjustments; Reset restores the selected group to source defaults.

Only the chosen axis in the chosen group changes. Other spinal axes, other regions, limb positions and saved references remain untouched. Reset group resets all three axes in that group. Native source models, API coordinates, bounds, solver variables and saved-reference formats are unchanged. The native engine still evaluates the resulting individual coordinates and supplies the muscle lengths and paths. Local moment-arm readouts remain tied to the selected individual joint, which the UI names explicitly.

`tests/spine-groups.spec.ts` checks redistribution at bounds, preservation of custom offsets, nonzero defaults, untouched coordinates, native response angles and length changes, saved references, group resets, individual fine tuning, keyboard operation and mobile accessibility.

## Spine path display

The regional spine view starts with both sides of the deep-back group: 164 native paths at the starting pose, including multifidus, longissimus thoracis and iliocostalis lumborum. It uses the same explicit source-family inventory as Whole body. Selected muscle and All paths modes, group and side filters, bone opacity and optional attachment markers are available above the viewer. The selected strand owns the length readout.

Single-path isolation is opt-in, with **Show muscle context** as the return action. Choosing a layer mode exits isolation. Counts reflect the visible filter, isolation, bones-only state and available current/reference geometry. Layer changes do not change the pose or saved reference. Bones-only and isolation state reset when the regional model reloads.

Selected paths are 4-pixel lines; related paths are 1.5 pixels and other context paths 1 pixel. These are display widths, not anatomical muscle diameters. Markers use fixed screen sizes. The default bone opacity is 70%, with peripheral context bones capped at 30%. The resting muscle surfaces remain in the separate anatomy reference.

`tests/spine-layers.spec.ts` verifies the actual rendered path IDs, default bilateral context, isolation/restore behavior, side filters, markers, opacity, grouped movement, saved references, model switching and accessibility. The automatic single-strand isolation that previously obscured the rest of the spine model is removed.

## Muscle coverage and the small deep muscles

All 552 upper-body fascicles in the template are retained; its additional 46 lower-limb fascicles are outside this workspace. This includes 50 lumbar multifidus, 24 thoracic multifidus and 14 additional cervical/cervicothoracic multifidus fascicles, plus 152 intercostal fascicles. It also includes longissimus, iliocostalis, quadratus lumborum, psoas, rectus abdominis, obliques, transversus abdominis, latissimus and the source's neck/shoulder muscles. A fascicle count is not a count of anatomical muscles.

**Rotatores, interspinales, lumbar intertransversarii, semispinalis thoracis, spinalis thoracis, levatores costarum, serratus posterior and innermost intercostals have no separately named native paths in this template.** They can be inspected in the **Deep muscles · rotatores and more** atlas collection. They do not receive invented attachments, native paths, length changes, moment arms or quiz answers. Source fascicles labeled `deepmult` remain multifidus; a short span is not sufficient evidence to relabel them rotatores.

The static Z-Anatomy subset contains 104 bilateral muscle surfaces and 70 contextual bone surfaces. It covers 550 of the 552 native paths, often as broader anatomical groups. The two semispinalis-capitis paths have no matching surface; spinalis capitis is not substituted. The rotatores surface is the atlas's combined named anatomy, not an individually segmented set of rotatores breves/longi. Names and correspondence are not a new anatomical validation of every source surface.

Source landmarks and world transforms are retained without fitting the atlas to the native model. The two bodies are **unregistered** and the atlas stays at rest. See [atlas attribution](../../public/models/muscle-reference/ATTRIBUTION.md) and [UAMS back-muscle anatomy](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-back-region/) for anatomical context.

## Numerical checks

Run `.venv-opensim/bin/python biomechanics/validate_spine.py`; machine-readable results: [spine-audit.json](spine-audit.json).

The audit covers 165 poses: baseline, both limits of all 51 controls, 60 seeded combined poses, and two combined corners. It compares 91,080 path lengths with a separately loaded source model, checks requested angles, checks actual movement signs, verifies repeatability after visiting another pose, and checks all four quiz predictions. A further 16,560 independent moment-arm/finite-difference comparisons verify the native outputs and action-availability gate. Each axis restores the target working state before probing, because OpenSim initialization returns mutable model state.

- Independent native length discrepancy: **0 mm**.
- Largest native/exported-polyline discrepancy: **0.0191 mm**, below the existing 1 mm gate.
- No path withheld in the sampled poses.
- Maximum requested-angle error: **4.45e−16°**; repeated-pose length error: **0 m**.
- **44 distinct muscle/coordinate pairs** had an unavailable moment arm in at least one sampled pose. These occur in transversus-abdominis routing. The runtime checks native moment arms against local native-length finite differences and withholds actions when disagreement exceeds 0.5 mm. It does not replace them with a fabricated action. The length/geometry result remains separately checked.

These checks establish numerical consistency within this application and sampled poses. They do not validate every anatomical attachment, exclude bone penetration, reproduce individual anatomy, establish tissue strain, or predict activation, forces, passive stiffness or spinal stability.

Browser coverage checks controls, all 17 level choices, preservation of other angles and saved references, cross-model switching, all eight extra atlas groups, native deep-muscle close-up, checked quiz answers and invalid-input rejection. The full regression suite also checks all eight workspaces at mobile width with accessibility analysis.
