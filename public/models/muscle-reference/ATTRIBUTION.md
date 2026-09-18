# Muscle anatomy references

These resting surfaces come from the existing Z-Anatomy atlas and a separately preserved BodyParts3D TFL/iliotibial-tract subset. They are displayed separately from the moving OpenSim body. No registration, pose deformation or muscle-strain calculation is applied to these surfaces.

Z-Anatomy by Gauthier Kervyn, derived from BodyParts3D, © The Database Center for Life Science. Browser GLB prepared by hpfrei (2026).

- https://www.z-anatomy.com/
- https://lifesciencedb.jp/bp3d/
- https://github.com/hpfrei/body-anatomy-3d-viewer
- Model license: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
- Original BodyParts3D attribution: CC BY-SA 2.1 Japan — https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en

Local adaptation: select 70 named right-sided muscle/head regions and 79 contextual bone meshes, applying their existing GLB world transforms. Original vertices and topology are retained after extraction. Runtime changes are camera position, colors and bone transparency. The extracted model remains under CC BY-SA 4.0. No endorsement is implied.

The JSON records the SHA-256 of the input body.glb. `scripts/export-muscle-atlas.mjs` reproduces extraction from that file using the explicit name correspondence in `src/muscleAtlas.ts`.

## Correspondence to lines

The moving line belongs to an OpenSim muscle–tendon compartment. A reference matches its named muscle, head or anatomical region; the atlas depicts a different body. When a model divides a muscle into multiple compartments but the atlas has only a broader surface, that limitation is stated in the reference panel. The whole surface must not be interpreted as an exact segmentation of the selected compartment.

The mapping covers all 33 shoulder paths, all 40 lower-limb paths and 17 arm paths: 70 muscle/head regions from the bundled atlas, plus the source TFL muscle and a separate iliotibial-tract surface. No neighboring muscle is substituted. These are named anatomical correspondences across different bodies, not geometric registration to OpenSim.

Surface appearance and color do not indicate native-model tissue strain, activation, tension or felt stretch. The orange color identifies the selected anatomy only. OpenSim bone motion and length calculations remain separate.

## BodyParts3D TFL and iliotibial tract supplement

**BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**.

The official [license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 2025-02-27 and checked 2026-09-10, permits use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The preserved 2013 OBJ headers still mention CC BY-SA 2.1 Japan; the current archive terms specify CC BY 4.0. This license applies to the newly retrieved supplement; it does not relicense the existing Z-Anatomy derivative.

Original files are retained in `bodyparts3d-source/`. Their header concept IDs and English names agree with the official IS-A element table:

| File | Concept | Structure |
| --- | --- | --- |
| FJ1438.obj | FMA22425 | Right tensor fasciae latae |
| FJ1423.obj | FMA58776 | Right iliotibial tract |
| FJ3152.obj | FMA16586 | Right hip bone |
| FJ3365.obj | FMA24474 | Right femur |
| FJ3387.obj | FMA24477 | Right tibia |
| FJ3366.obj | FMA24480 | Right fibula |

Sources: [official download index](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), [mesh archive](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip), [concept-to-element table](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt).

Conversion: `python3 scripts/export-tfl-reference.py`. The JSON includes each original file's SHA-256, vertex and triangle counts. A single proper rotation and unit conversion maps source millimetres `(x, y, z)` to browser metres `(x, z, -y) / 1000`. All six structures retain their shared source placement and topology. No independent bone fitting, muscle deformation, smoothing or generated replacement surface is used. Colors, normals and camera views are assigned for display. The pale blue surface is fascia; orange identifies the muscle.

The source bones accompany the TFL/tract instead of being mixed with the differently posed/scaled Z-Anatomy meshes. Neither resting dataset is aligned to the moving OpenSim body. The native TFL route represents muscle and connective tissue together and does not partition measured length change into muscle or fascia strain.

## Bilateral neck export

`neck.json` is a separate subset of the same bundled Z-Anatomy GLB, under the same CC BY-SA 4.0 attribution above. `scripts/export-neck-atlas.mjs` extracts 36 named muscle surfaces (18 on each side) and 60 contextual bone meshes, preserving the source world transforms, vertices and topology. Right/left labels follow the source GLB's coordinate convention (negative X is right). No reflection, fitting or pose deformation is applied.

The surfaces map to 48 native neck paths. Multiple SCM, longus colli, splenius and trapezius compartments may share a broader surface and are labeled accordingly. Four semispinalis-capitis model compartments have no corresponding surface in this atlas and are explicitly unavailable as body references. Spinalis capitis is not substituted. Native-path calculations remain separate. The neck model credits and terms are available in [the neck notice](../neck/LICENSE.txt).

## Bilateral spine export

`spine.json` is a separate Z-Anatomy subset under the same CC BY-SA 4.0 attribution above. `scripts/export-spine-atlas.mjs` extracts 104 bilateral muscle surfaces and 70 bone surfaces, retaining source world placement and topology. No fitting, reflection, deformation or generated muscle surfaces are used. The dataset includes resting rotatores, interspinales, lumbar intertransversarii and other atlas-only structures whose native movement calculations are unavailable. Rotatores is a combined atlas group, not separately segmented breves/longi. Broader surfaces map to 550 native spine-model fascicles; two semispinalis-capitis paths explicitly lack a matching surface. Atlas anatomy is not aligned to the moving OpenSim model.
