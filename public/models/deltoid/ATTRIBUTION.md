# Deltoid anatomy and movement study

This package displays two separate bodies linked by muscle-region name. It does **not** register the atlas to the research model or animate muscle surfaces.

## Resting anatomy

Z-Anatomy by Gauthier Kervyn, derived from BodyParts3D, © The Database Center for Life Science. Browser GLB prepared by hpfrei (2026).

- https://www.z-anatomy.com/
- https://lifesciencedb.jp/bp3d/
- https://github.com/hpfrei/body-anatomy-3d-viewer
- CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- Original BodyParts3D attribution: CC BY-SA 2.1 Japan: https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en

Local adaptation: extract the right clavicle, scapula, humerus and three deltoid regions from the bundled GLB, applying its existing object transforms. Vertices and triangle topology are unchanged after extraction. The display applies uniform scale, translation and colors. The atlas-derived components remain under CC BY-SA 4.0. No endorsement is implied.

## Movement and path lengths

Seth / Belli subject-scaled shoulder model, from ComputationalBiomechanicsLab/rmr-solver, commit d40ebd8ba658633993e531e408c0d96df30ff367; `OpenSim Models/for CMC/TSM_subject_CMC_noWeight.osim`. Model SHA-256: 9342ecc5534a533e78ac2efcc72ab6377a5220a71bda1c25f5675ba51e9d8e16.

- Repository and data license: https://github.com/ComputationalBiomechanicsLab/rmr-solver/tree/d40ebd8ba658633993e531e408c0d96df30ff367
- Model study: https://doi.org/10.3389/fnbot.2019.00090
- Data license: CC BY 4.0, per the source package's LICENSE_data.

Native OpenSim 4.6 supplies model bone transforms, wrapped muscle–tendon paths and path lengths. The study exports 26 discrete poses at 20–70° glenohumeral elevation (2° steps); remaining coordinates keep the model's assembled defaults, including a fixed shoulder blade and straight elbow. This is not total arm elevation. Playback steps through the exported poses without surface deformation or numerical interpolation. End markers are native path endpoints, not the full anatomical attachment footprints.

The package records its model version, OpenSim version and input atlas hashes. The separate joint explorer provides native multidimensional controls and source motion tracks.

## Prototype outcome and checks

The attempted surface fit was rejected. Registering the atlas to different research-model bones, warping with native path guides and enforcing graphical volume/clearance constraints still produced folded, flattened or wing-like muscle shapes. These shapes are not included in the application or this package. Credible moving muscle surfaces remain unresolved.

The shipped package was checked against a fresh native model in reverse pose order: 78 compartment comparisons across 26 poses, with zero exported-vs-native length, path-coordinate or transform differences at stored precision. Displayed path-polyline lengths agree to floating-point precision. The three atlas muscle regions and three bones match their extracted input vertices and topology exactly.

These are software/data checks, not biological validation. Path length is not muscle-fiber strain, activation, tension, felt stretch or a safe range of motion. Surface colors identify regions only.
