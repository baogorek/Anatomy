# TFL and iliotibial-tract reference

The previously missing TFL surface was a gap in the bundled GLB, not an anatomical absence. The official BodyParts3D 4.0 IS-A archive contains both the right TFL (FMA22425 / FJ1438) and right iliotibial tract (FMA58776 / FJ1423). The OBJ headers and official `isa_element_parts.txt` agree on these identities. The app now maps `tfl_r` explicitly to this muscle and shows the associated fascia as a separately colored, independently visible structure.

## Source and placement checks

Recovered six entries from the official `isa_BP3D_4.0_obj_99.zip`. Extraction checked ZIP CRC32; the exported JSON and coverage report record each preserved OBJ's SHA-256, vertex count and triangle count. The muscle has 1,087 vertices / 1,254 triangles; the fascia has 9,425 / 17,172. All positions are finite, all indices in bounds, and the six structures have negative source X (the archive's right side).

Only the shared proper rotation `(x, y, z) -> (x, z, -y)` and millimetres-to-metres conversion are applied. The bones, muscle and fascia retain their original relative placement. The raw OBJ files are bundled for reproducibility. `python3 scripts/export-tfl-reference.py` repeats the conversion without downloading anything.

The source bones differ from the bundled Z-Anatomy geometry. For example, source femur superior/inferior bounds after unit/axis conversion are 0.368–0.834 m, versus approximately 0.429–0.885 m in the bundled atlas; the hip-bone bounds and extents also differ. This is not evidence of a shared, directly interchangeable pose. The reference therefore uses its original hip bone, femur, tibia and fibula instead of independently fitting source tissues onto the other atlas or OpenSim body. Visual inspection checks the resulting muscle/fascia relationship from front, lateral and oblique views. This is a resting anatomical reference, not patient-specific anatomy or tissue-mechanics validation.

The source archive's current license is CC BY 4.0 (updated 2025-02-27, checked 2026-09-10). The old license text inside the preserved OBJ comments is documented separately from the current archive terms. Existing Z-Anatomy assets retain their CC BY-SA 4.0 attribution. See [full source attribution](../../public/models/muscle-reference/ATTRIBUTION.md).

## Interaction and interpretation

Click a path, or select it in the muscle list, to open the surface beside the moving model. At narrower widths the surface follows the model vertically. TFL muscle is orange; IT-band fascia is pale blue. Independent checkboxes expose each structure. The default oblique view shows their relationship, with front/back/side views and free rotation available. Closing the reference restores the wider movement canvas.

Hip/knee navigation preserves an explicitly opened muscle reference as well as the existing joint pose. Switching to a different native model closes the reference. Prediction questions continue to conceal the muscle name and reference until revealed. Reference geometry receives no joint coordinates. The native TFL path and its length change cover a muscle–connective-tissue route; the readout does not split that change into muscle strain and fascia strain.

The audit now covers 33/33 shoulder and 29/29 hip/knee compartments, using 43 muscle/head surfaces and one fascia surface. Compartments mapped to a broader surface remain explicitly labeled. This completes the current named-reference coverage, not a full-body atlas, an ankle implementation, or a moving-muscle simulation. Native solver code and model assets are unchanged.

## Reproduction and validation

- `python3 scripts/export-tfl-reference.py`
- With Vite/API running: `node scripts/audit-muscle-references.mjs`
- `npx playwright test`
- `npm run build`

Browser checks exercise native-line picking, switching between the two atlas datasets, separate muscle/fascia visibility, rendered-reference invariance while moving hip/knee, preservation across joint focus changes, compartment labels, quiz concealment, asset-load failure, and mobile accessibility. The complete existing test suite also covers native controls, learning, notes and fullscreen.

Final verification: all 30 browser tests passed; TypeScript and the production build passed. The production preview on port 4173 was visually checked in front, side and oblique views, with tissue toggles, fullscreen and a 390 px mobile viewport. No browser runtime errors or horizontal mobile overflow were observed.
