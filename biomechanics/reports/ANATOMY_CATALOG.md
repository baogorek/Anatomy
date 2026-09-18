# Integrated anatomy catalog

Movement Lab is the app's home. The separate Explore and My notes destinations are removed; old browser notes and learning records remain untouched. The broader atlas is accessible through **Anatomy reference** without unmounting either movement workspace.

## Coverage and label meaning

The bundled Z-Anatomy GLB contains 440 muscle-tagged meshes with 222 distinct source names. These include bilateral copies, muscle heads/parts and some tendons/fascia; none of these numbers is a count of distinct human muscles. The old upper-body viewer clipped this collection at the pelvis and provided only 12 guided entries. The integrated catalog makes every named muscle-tagged surface selectable, including the lower body.

`src/anatomyCatalog.json` records the GLB checksum, native source-model hashes, exposed path counts and explicit anatomical links. Rebuild it using `node scripts/build-anatomy-catalog.mjs` with the studio running. The generator uses the existing reviewed atlas mappings, normalizes side prefixes, and adds named correspondences for the whole-body leg muscles. It does not equate similarly named but different anatomical structures, register atlas surfaces to native endpoints, or transfer lengths between models.

- **Modeled** means at least one linked path is exposed in an app workspace. The path selector names the workspace, side and compartment. A whole muscle's surface can correspond to several modeled strands; a grouped native path can correspond to more than one named atlas muscle. Length and reliability are evaluated in the selected movement model.
- **Anatomy only** means no verified link to an exposed movement path. The resting shape remains available; there is no length readout or solver for that catalog entry. This is not a claim that the muscle is absent from all OpenSim source models.

Examples: biceps brachii and rhomboids link to regional models but are absent from this whole-body model. Diaphragm, subclavius and masseter remain static references. Some finger/thumb and hyoid actuators exist in the pinned source files but are not exposed by the current movement adapters. The catalog does not silently enable them.

## Interaction and state

The atlas defaults to the selected shape with translucent nearby bones. Optional surrounding muscles, side selection, camera views, zoom and fullscreen support inspection. Shapes remain at rest. The original guided muscle families retain attachment/action summaries.

Opening the catalog pauses recorded playback and cancels any pending path search. Closing it preserves live angles, selected paths, layers and saved references. Following a link explicitly selects the corresponding model/path; moving between different regional models retains the existing model-specific reset/reference behavior. Catalog labels remain available when the native service is offline, and links lead to the normal service-error state rather than changing coverage labels.

## Checks

Browser tests compare the catalog against every muscle-tagged source name, verify the GLB checksum and confirm that every linked native ID is exposed by its recorded model. Integration checks cover regional and whole-body navigation, static-only shapes, failed geometry downloads, actual highlighted meshes, pose/reference preservation, stale solver cancellation, mobile layout and automated accessibility checks. These establish application behavior, not biological validation.
