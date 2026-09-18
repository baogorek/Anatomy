# Joint workspaces

The main movement experience now covers shoulder, hip and knee explicitly. Three preset explorations per joint operate the live native model; each features several muscles to compare. Four prediction prompts per joint use native reference/target lengths and the existing versioned history. No completion state is introduced.

Bone selection is available by clicking or a keyboard-accessible menu. The highlighted mesh is native display geometry, and camera focus uses the corresponding body's coordinate origin (humerus, femur or tibia), not a fitted atlas landmark. Hip/knee focus shares pose and reference state. Preset explorations explicitly compare with the model baseline, while manual controls retain the active reference.

Sources for introductory anatomy: [OpenStax selected synovial joints](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints) and [lower-limb muscles](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs). Model-specific constraints and geometric calculations continue to use the original pinned model packages and engine. The knee does not acquire three unconstrained rotation sliders.

Verification: all 26 browser tests passed, including the existing atlas, notes, learning, references and native motion workflows. New tests exercise default joint navigation, bone identification, selected comparisons and sign filters, optional close-up return state, hip/knee reference preservation, knee-specific quizzes, mobile layout and automated WCAG A/AA checks. All nine presets and 12 quiz target poses were also evaluated natively: all featured muscle paths were available. This is software/geometry verification, not biological validation of stretch positions.

## Muscle surfaces linked to path selection

A complete inventory of the bundled GLB found hip and thigh muscles that the upper-body viewer had not displayed. Earlier statements that those atlas assets were absent were incorrect. The new reference component uses 42 extracted muscle/head regions, with explicit mappings for all 33 shoulder and 28 of 29 hip/knee paths. Tensor fasciae latae was unavailable in that first extraction; the source supplement below resolves it. Compartment-to-broader-muscle mappings are labeled, rather than presented as an exact surface segmentation.

Hovering a visible path shows its name. Mouse/touch picking includes a small screen-space tolerance and checks against foreground bones; clicking a path or selecting it from the list opens a separate, rotatable resting atlas reference. Path names, selected-path callouts and anatomy references are suppressed during unanswered predictions. The native solver, coordinates and path-length calculations are unchanged.

Targeted browser checks exercise clicking a rendered path (using the native geometry to locate candidate screen positions), name/shape correspondence, explicit missing-reference handling, broader-compartment labels, quiz concealment, reference-pixel invariance under joint movement, mobile accessibility and a failed atlas download. The reference renderer retains its drawing buffer so a static canvas remains readable when scrolled out of and back into view. The scrolling results column keeps each child at its natural height, preventing the muscle list from collapsing when the reference is open.

Final verification after the muscle-reference integration: TypeScript and the production build pass; all 29 browser tests pass, including the full pre-existing atlas, continuous learning, notes, joint control and numerical readout workflows. The native solver and its model assets were not changed by this feature.

## Completed TFL reference coverage

Recovered the original BodyParts3D TFL and iliotibial tract, with their matching source bones, instead of substituting nearby tissue. The atlas now has references for all 62 native compartments. The combined TFL view distinguishes muscle and fascia with independent controls. References open beside the native canvas, with a stacked layout on smaller screens; explicitly inspected muscles persist across hip/knee focus changes. The results column remains available for comparisons. See [source and geometry verification](TFL_REFERENCE.md).

Final verification: all 30 browser tests passed; TypeScript and the production build passed. The production preview on port 4173 was visually checked in front, side and oblique views, with tissue toggles, fullscreen and a 390 px mobile viewport. No browser runtime errors or horizontal mobile overflow were observed.
