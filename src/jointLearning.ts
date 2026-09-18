import type { PoseRequest, Region } from "./biomechanics";
export type Joint =
  "spine" | "neck" | "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle";
export const jointRegion = (joint: Joint): Region =>
  joint === "spine"
    ? "spine"
    : joint === "neck"
      ? "neck"
      : joint === "shoulder"
        ? "shoulder"
        : joint === "elbow" || joint === "wrist"
          ? "arm"
          : "hip";
export type Question = {
  id: string;
  request: PoseRequest;
  muscle: string;
  prompt: string;
};
export type Exploration = {
  id: string;
  label: string;
  request: PoseRequest;
  observe: string;
  muscles: string[];
};
const scapularExplorations: Exploration[] = [
  {
    id: "girdle-protract-manual",
    label: "Protract the scapula",
    request: { coordinates: { scapula_abduction: 0 } },
    observe:
      "Move the scapular protraction / retraction slider while keeping scapular elevation and upward rotation fixed. Compare serratus anterior with middle trapezius and rhomboids. The clavicle follows the scapula to keep their connection closed.",
    muscles: ["SerratusAnterior_M", "TrapeziusScapula_M", "Rhomboideus_I"],
  },
  {
    id: "girdle-elevate-manual",
    label: "Elevate the scapula",
    request: { coordinates: { scapula_elevation: 6 } },
    observe:
      "Move the scapular elevation / depression slider to raise or lower the scapula while keeping the other scapular controls fixed. Compare levator scapulae and superior trapezius with inferior trapezius.",
    muscles: ["LevatorScapulae", "TrapeziusScapula_S", "TrapeziusScapula_I"],
  },
  {
    id: "girdle-rotate-manual",
    label: "Rotate the scapula upward",
    request: { coordinates: { scapula_upward_rot: 35 } },
    observe:
      "Move the scapular upward / downward rotation slider. Then change the arm elevation control to compare scapular rotation with movement of the humerus relative to the scapula.",
    muscles: ["TrapeziusScapula_I", "SerratusAnterior_M", "LevatorScapulae"],
  },
  {
    id: "girdle-shrug",
    label: "Shrug and lower the shoulder",
    request: { track: "SHRUG01", progress: 25 },
    observe:
      "Scrub or play the recorded shrug. Compare superior trapezius and levator scapulae with inferior trapezius as the scapula rises and lowers. The colors show path-length changes, not muscle activation.",
    muscles: ["TrapeziusScapula_S", "LevatorScapulae", "TrapeziusScapula_I"],
  },
  {
    id: "girdle-abduction",
    label: "Raise the arm with the scapula",
    request: { track: "ABD01", progress: 50 },
    observe:
      "Follow scapular upward rotation alongside elevation of the humerus relative to the scapula. Compare superior and inferior trapezius with serratus anterior. This recorded coordination is not a fixed ratio for every arm raise.",
    muscles: [
      "SerratusAnterior_M",
      "TrapeziusScapula_S",
      "TrapeziusScapula_I",
      "DeltoideusScapula_M",
    ],
  },
  {
    id: "girdle-forward",
    label: "Follow a forward arm raise",
    request: { track: "FLX01", progress: 25 },
    observe:
      "Watch the scapula move around the thorax and rotate during forward arm elevation and return. Compare serratus, rhomboids and middle trapezius. This combines movements; it is not an isolated protraction/retraction test. Use Front or Side to inspect pectoralis minor.",
    muscles: [
      "SerratusAnterior_M",
      "Rhomboideus_I",
      "TrapeziusScapula_M",
      "PectoralisMinor",
    ],
  },
];
const jointSource =
  "https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints";
export const joints: Record<
  Joint,
  {
    name: string;
    anatomy: string;
    bones: string[];
    context: string;
    source: string;
    explorations: Exploration[];
  }
> = {
  spine: {
    name: "Spine",
    anatomy:
      "The thoracolumbar spine has twelve thoracic and five lumbar vertebrae. Movement is shared across many joints. Select an intervertebral level to examine its flexion, lateral flexion and axial rotation.",
    bones: ["thoracic6.vtp", "lumbar3.vtp", "lumbar4.vtp", "sacrum.vtp"],
    context:
      "Explore all 552 upper-body fascicles in this model, including multifidus, longissimus, iliocostalis, quadratus lumborum, abdominal muscles and intercostals. The deep-muscle anatomy collection also includes rotatores and other muscles without separate paths in this model.",
    source:
      "https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-back-region/",
    explorations: [
      {
        id: "spine-lumbar-flex",
        label: "Flex L3–L4",
        request: { spineLevel: "L3_L4", coordinates: { L3_L4_FE: -3 } },
        observe:
          "Compare multifidus with rectus abdominis as one lumbar joint flexes. Other joints retain their starting angles; this is an isolated model movement, not a whole-trunk movement pattern.",
        muscles: [
          "spine__MF_m1s_r",
          "spine__rect_abd_r",
          "spine__QL_post_I_1-L3_r",
        ],
      },
      {
        id: "spine-sidebend",
        label: "Side-bend L3–L4 right",
        request: { spineLevel: "L3_L4", coordinates: { L3_L4_LB: 2 } },
        observe:
          "Compare right and left quadratus lumborum fascicles. Their attachment levels determine whether they cross the joint you are moving.",
        muscles: ["spine__QL_post_I_1-L3_r", "spine__QL_post_I_1-L3_l"],
      },
      {
        id: "spine-thoracic",
        label: "Rotate T6–T7 left",
        request: { spineLevel: "T6_T7", coordinates: { T6_T7_AR: 1 } },
        observe:
          "Inspect the short multifidus fascicle spanning T8 to T6. Use Isolate path and Focus joint to see its course. A short path may change by less than the 1 mm color threshold.",
        muscles: ["spine__multifidus_T8_T6", "spine__multifidus_T8_T6_L"],
      },
      {
        id: "spine-levels",
        label: "Flex several lumbar joints",
        request: {
          spineLevel: "L3_L4",
          coordinates: {
            L1_L2_FE: -3,
            L2_L3_FE: -3,
            L3_L4_FE: -3,
            L4_L5_FE: -3,
            L5_S1_FE: -3,
          },
        },
        observe:
          "This illustrative pose applies 3° flexion at each of five lumbar joints. Equal sharing is a teaching example, not a measured spinal rhythm. Change levels to adjust the joints independently.",
        muscles: ["spine__MF_m1s_r", "spine__LTpL_L1_r", "spine__rect_abd_r"],
      },
    ],
  },
  neck: {
    name: "Neck",
    anatomy:
      "The cervical spine has seven vertebrae between the skull and thorax. Turning, tilting and nodding involve several joints, with different contributions from the upper and lower neck.",
    bones: ["cerv1.vtp", "cerv2.vtp", "skull.vtp", "rotatedcerv7.vtp"],
    context:
      "Compare right and left SCM (sternocleidomastoid), the three scalenes, and deeper neck muscles. The six controls preserve this model’s separate upper and lower neck motions. The thorax, ribs and shoulder girdle stay fixed.",
    source:
      "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back",
    explorations: [
      {
        id: "neck-turn",
        label: "Turn the head left",
        request: { coordinates: { yaw1: 20, yaw2: 10 } },
        observe:
          "Compare right and left SCM. In this pose, the right sternal–mastoid path shortens as the face turns left. Compare it with right splenius capitis, which has a different rotational action.",
        muscles: ["stern_mast", "stern_mast_L", "splen_cap_sklc6"],
      },
      {
        id: "neck-tilt",
        label: "Tilt the head right",
        request: { coordinates: { roll2: 15, roll1: 3 } },
        observe:
          "Compare the anterior, middle and posterior scalenes on the right, then select their left counterparts. This is side bending; keep rotation separate using the sliders.",
        muscles: ["scalenus_ant", "scalenus_med", "scalenus_post"],
      },
      {
        id: "neck-nod",
        label: "Nod through the upper neck",
        request: { coordinates: { pitch1: -12 } },
        observe:
          "The upper-neck nod shortens longus capitis, while the anterior scalene stays essentially unchanged. Save this reference and move only the lower-neck flexion control to explore the difference.",
        muscles: ["long_cap_sklc4", "scalenus_ant", "stern_mast"],
      },
      {
        id: "neck-flex",
        label: "Bend the lower neck forward",
        request: { coordinates: { pitch2: -20 } },
        observe:
          "Keep the upper neck neutral. Compare SCM, longus colli and a posterior neck muscle. Upper-neck nodding and lower-neck bending do not have identical effects on every path.",
        muscles: ["stern_mast", "long_col_c1c5", "splen_cap_sklc6"],
      },
    ],
  },
  elbow: {
    name: "Elbow",
    anatomy:
      "The humerus meets the ulna and radius at the elbow. Flexion bends the elbow; extension straightens it. Forearm rotation occurs at the radioulnar joints.",
    bones: ["ulna.vtp", "humerus.vtp", "radius.vtp"],
    context:
      "In pronation the radius crosses the ulna; in supination they become more parallel. Zero forearm rotation is the thumb-up position. Compare biceps, brachialis, triceps and the forearm rotators.",
    source: jointSource,
    explorations: [
      {
        id: "elbow-bend",
        label: "Bend the elbow",
        request: { coordinates: { elbow_flexion: 90 } },
        observe:
          "Compare biceps and brachialis with triceps as the elbow bends. Keep forearm rotation fixed first.",
        muscles: ["BIClong", "BRA", "TRIlong"],
      },
      {
        id: "elbow-turn",
        label: "Supinate the forearm",
        request: { coordinates: { elbow_flexion: 90, pro_sup: -60 } },
        observe:
          "With the elbow bent, move forearm rotation between neutral and supination. Biceps also contributes to supination; compare its route with the pronators.",
        muscles: ["BIClong", "PT", "PQ"],
      },
      {
        id: "elbow-crossing",
        label: "Follow a muscle across the elbow and wrist",
        request: { coordinates: { elbow_flexion: 90 } },
        observe:
          "Save this pose as your reference, then change only wrist flexion. Flexor carpi radialis crosses the elbow and wrist; brachialis crosses only the elbow. Switching to Wrist preserves this pose and reference.",
        muscles: ["FCR", "BRA", "ECRB"],
      },
    ],
  },
  wrist: {
    name: "Wrist",
    anatomy:
      "The radius and carpal bones form the wrist complex. Flexion brings the palm toward the forearm; extension brings the back of the hand toward it.",
    bones: ["lunate.vtp", "radius.vtp", "sdfastSCAPHOIDw.vtp", "capitate.vtp"],
    context:
      "Radial deviation moves toward the thumb; ulnar deviation moves toward the little finger. Forearm pronation and supination rotate the hand through the radioulnar joints. The fingers remain in the model’s fixed grip.",
    source: "https://nmbl.stanford.edu/publications/pdf/Holzbaur2005.pdf",
    explorations: [
      {
        id: "wrist-flex",
        label: "Flex the wrist",
        request: { coordinates: { flexion: 40 } },
        observe:
          "Compare flexor carpi radialis and flexor carpi ulnaris with a wrist extensor as the palm moves toward the forearm.",
        muscles: ["FCR", "FCU", "ECRB"],
      },
      {
        id: "wrist-extend",
        label: "Extend the wrist",
        request: { coordinates: { flexion: -40 } },
        observe:
          "Bring the back of the hand toward the forearm. Compare the radial extensors with flexor carpi radialis.",
        muscles: ["ECRL", "ECRB", "FCR"],
      },
      {
        id: "wrist-deviate",
        label: "Move toward the little finger",
        request: { coordinates: { deviation: 20 } },
        observe:
          "Compare the ulnar flexor and extensor with a radial extensor. Flexor and extensor names describe one action; both ulnar muscles can contribute to ulnar deviation.",
        muscles: ["FCU", "ECU", "ECRB"],
      },
    ],
  },
  ankle: {
    name: "Ankle",
    anatomy:
      "The tibia and fibula surround the talus at the ankle hinge. Dorsiflexion brings the foot toward the shin; plantarflexion points it away.",
    bones: ["r_talus.vtp", "r_tibia.vtp", "r_fibula.vtp", "r_foot.vtp"],
    context:
      "A separate subtalar control turns the heel beneath the talus. Compare gastrocnemius, which crosses the knee and ankle, with soleus, which does not cross the knee. The toes stay at their starting angle.",
    source: jointSource,
    explorations: [
      {
        id: "ankle-lift",
        label: "Bring the foot toward the shin",
        request: { coordinates: { ankle_angle_r: 20, knee_angle_r: 0 } },
        observe:
          "Keep the knee straight and compare gastrocnemius, soleus and tibialis anterior as you move the ankle slider from dorsiflexion to plantarflexion.",
        muscles: ["gasmed_r", "soleus_r", "tibant_r"],
      },
      {
        id: "ankle-calf",
        label: "Compare straight-knee and bent-knee calf paths",
        request: { coordinates: { ankle_angle_r: 20, knee_angle_r: 0 } },
        observe:
          "Save this straight-knee pose as your reference, then bend only the knee to 90°. Keep the ankle at 20°. Both gastrocnemius heads cross the knee and shorten; soleus does not cross the knee and stays essentially the same length.",
        muscles: ["gasmed_r", "gaslat_r", "soleus_r"],
      },
      {
        id: "ankle-turn",
        label: "Turn the sole inward",
        request: { coordinates: { subtalar_angle_r: 15 } },
        observe:
          "Move the subtalar slider through inversion and eversion while keeping the ankle angle fixed. Compare tibialis posterior with fibularis longus and brevis. The model represents this with one oblique axis.",
        muscles: ["tibpost_r", "perlong_r", "perbrev_r"],
      },
    ],
  },
  shoulder: {
    name: "Shoulder",
    anatomy:
      "The humeral head meets the glenoid of the scapula in a ball-and-socket joint.",
    bones: ["humerus.vtp", "scapula.vtp", "clavicle.vtp"],
    context:
      "Control the arm and scapula together here. The clavicle follows scapular movement to keep their connection closed. Use Back or Focus scapula to inspect the shoulder blade; study tracks show examples of coordinated movement. This model contains the right shoulder.",
    source: jointSource,
    explorations: [
      {
        id: "elevation",
        label: "Raise the arm",
        request: { coordinates: { shoulder_elv: 70 } },
        observe:
          "Compare the deltoid, latissimus and pectoralis paths as the arm rises. Select a name below to follow its route.",
        muscles: [
          "DeltoideusScapula_M",
          "LatissimusDorsi_M",
          "PectoralisMajorThorax_I",
        ],
      },
      {
        id: "rotation",
        label: "Rotate the upper arm",
        request: { coordinates: { shoulder_elv: 50, axial_rot: -20 } },
        observe:
          "Keep elevation at 50° and use shoulder internal / external rotation. Compare teres minor with pectoralis major. Any path that fails its geometry check is withheld.",
        muscles: [
          "TeresMinor",
          "PectoralisMajorClavicle_S",
          "DeltoideusScapula_P",
        ],
      },
      ...scapularExplorations,
    ],
  },
  hip: {
    name: "Hip",
    anatomy:
      "The femoral head meets the acetabulum of the pelvis in a ball-and-socket joint.",
    bones: ["r_pelvis.vtp", "r_femur.vtp"],
    context:
      "Move the thigh forward/back, across/outward, or rotate it. Keep an eye on knee position: several muscles cross both joints.",
    source: jointSource,
    explorations: [
      {
        id: "hip-forward",
        label: "Bring the thigh forward",
        request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 0 } },
        observe:
          "Compare psoas, gluteus maximus and a hamstring with the knee straight. Then bend the knee to see which comparisons change.",
        muscles: ["psoas_r", "glmax2_r", "bflh_r"],
      },
      {
        id: "hip-out",
        label: "Move the thigh outward",
        request: { coordinates: { hip_adduction_r: -25 } },
        observe:
          "Use Z to bring the thigh outward and back. Compare an adductor with gluteus medius and tensor fasciae latae.",
        muscles: ["addlong_r", "glmed2_r", "tfl_r"],
      },
      {
        id: "hip-turn",
        label: "Rotate the thigh",
        request: { coordinates: { hip_flexion_r: 30, hip_rotation_r: 20 } },
        observe:
          "Keep flexion at 30° and move Y through rotation. Compare piriformis and the gluteal compartments at the same pose.",
        muscles: ["piri_r", "glmax2_r", "glmed2_r"],
      },
    ],
  },
  knee: {
    name: "Knee",
    anatomy:
      "The femur articulates with the tibia and patella. Flexion and extension are the main movements explored here.",
    bones: ["r_femur.vtp", "r_tibia.vtp", "r_patella.vtp"],
    context:
      "The knee is not three freely rotating axes. This model couples its other motions to flexion. Hip controls stay available for muscles crossing both joints.",
    source: jointSource,
    explorations: [
      {
        id: "knee-bend",
        label: "Bend the knee",
        request: { coordinates: { hip_flexion_r: 0, knee_angle_r: 90 } },
        observe:
          "Compare quadriceps and hamstring paths as the knee bends. Keep the hip fixed first, then change it separately.",
        muscles: ["vaslat_r", "recfem_r", "bflh_r"],
      },
      {
        id: "knee-two-joints",
        label: "Combine hip and knee flexion",
        request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 90 } },
        observe:
          "Compare rectus femoris with vastus lateralis. Move only the hip slider: rectus femoris crosses both joints, while vastus lateralis crosses the knee.",
        muscles: ["recfem_r", "vaslat_r", "bflh_r"],
      },
      {
        id: "knee-straight",
        label: "Straighten the knee at a flexed hip",
        request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 0 } },
        observe:
          "Save this as your reference, then bend only the knee. Compare the long and short heads of biceps femoris; only the long head also crosses the hip.",
        muscles: ["bflh_r", "bfsh_r", "semiten_r"],
      },
    ],
  },
};
const scapularQuestions: Question[] = [
  {
    id: "girdle-shrug-levator",
    request: { track: "SHRUG01", progress: 25 },
    muscle: "LevatorScapulae",
    prompt:
      "At 25% of the recorded shrug, how does the levator scapulae path compare with the model starting pose?",
  },
  {
    id: "girdle-shrug-inferior-trapezius",
    request: { track: "SHRUG01", progress: 25 },
    muscle: "TrapeziusScapula_I",
    prompt:
      "At 25% of the recorded shrug, predict the inferior trapezius path change from the model starting pose.",
  },
  {
    id: "girdle-abduction-serratus",
    request: { track: "ABD01", progress: 50 },
    muscle: "SerratusAnterior_M",
    prompt:
      "At 50% of the recorded arm abduction, predict the middle serratus anterior path change from the model starting pose.",
  },
  {
    id: "girdle-forward-rhomboids",
    request: { track: "FLX01", progress: 25 },
    muscle: "Rhomboideus_I",
    prompt:
      "At 25% of the recorded forward arm raise, predict the inferior rhomboid path change from the model starting pose.",
  },
];
export const quizPoses: Record<Joint, Question[]> = {
  spine: [
    {
      id: "spine-flex-multifidus",
      request: { spineLevel: "L3_L4", coordinates: { L3_L4_FE: -3 } },
      muscle: "spine__MF_m1s_r",
      prompt:
        "Flex L3–L4. How does this right lumbar multifidus fascicle change?",
    },
    {
      id: "spine-flex-rectus",
      request: { spineLevel: "L3_L4", coordinates: { L3_L4_FE: -3 } },
      muscle: "spine__rect_abd_r",
      prompt: "Flex L3–L4. How does the right rectus abdominis path change?",
    },
    {
      id: "spine-extend-multifidus",
      request: { spineLevel: "L3_L4", coordinates: { L3_L4_FE: 3 } },
      muscle: "spine__MF_m1s_r",
      prompt:
        "Extend L3–L4. How does this right lumbar multifidus fascicle change?",
    },
    {
      id: "spine-distant-joint",
      request: { spineLevel: "L3_L4", coordinates: { L3_L4_FE: -3 } },
      muscle: "spine__multifidus_T8_T6",
      prompt:
        "Flex only L3–L4. Does the multifidus fascicle between T8 and T6 change length when both attachments move together?",
    },
  ],
  neck: [
    {
      id: "neck-right-scm-left-turn",
      request: { coordinates: { yaw1: 20, yaw2: 10 } },
      muscle: "stern_mast",
      prompt:
        "Turn the face left from neutral. Does the right SCM sternal–mastoid path become longer or shorter?",
    },
    {
      id: "neck-left-scm-left-turn",
      request: { coordinates: { yaw1: 20, yaw2: 10 } },
      muscle: "stern_mast_L",
      prompt:
        "Turn the face left from neutral. Predict the left SCM sternal–mastoid path change.",
    },
    {
      id: "neck-right-scalene-tilt",
      request: { coordinates: { roll2: 15, roll1: 3 } },
      muscle: "scalenus_ant",
      prompt:
        "Tilt the head right without turning it. Predict the right anterior scalene path change.",
    },
    {
      id: "neck-left-scalene-tilt",
      request: { coordinates: { roll2: 15, roll1: 3 } },
      muscle: "scalenus_ant_L",
      prompt:
        "Tilt the head right without turning it. Predict the left anterior scalene path change.",
    },
    {
      id: "neck-upper-nod-longus",
      request: { coordinates: { pitch1: -12 } },
      muscle: "long_cap_sklc4",
      prompt:
        "Nod down using only upper-neck flexion. How does the right longus capitis path change?",
    },
    {
      id: "neck-upper-nod-scalene",
      request: { coordinates: { pitch1: -12 } },
      muscle: "scalenus_ant",
      prompt:
        "Nod down using only the upper-neck control. What happens to the right anterior scalene path, which does not attach to the skull?",
    },
  ],
  elbow: [
    {
      id: "elbow-biceps",
      request: { coordinates: { elbow_flexion: 90 } },
      muscle: "BIClong",
      prompt:
        "Bend the elbow with forearm rotation unchanged. How does the biceps long-head path change from the starting pose?",
    },
    {
      id: "elbow-triceps",
      request: { coordinates: { elbow_flexion: 90 } },
      muscle: "TRIlong",
      prompt:
        "Bend the elbow to 90°. Predict the triceps long-head path change.",
    },
    {
      id: "elbow-brachialis",
      request: { coordinates: { elbow_flexion: 90 } },
      muscle: "BRA",
      prompt:
        "Bend the elbow to 90°. Does the brachialis path become longer or shorter?",
    },
    {
      id: "elbow-pronator",
      request: { coordinates: { pro_sup: -60 } },
      muscle: "PQ",
      prompt:
        "Supinate the forearm from the thumb-up starting position. How does the pronator quadratus path change?",
    },
  ],
  wrist: [
    {
      id: "wrist-fcr",
      request: { coordinates: { flexion: 40 } },
      muscle: "FCR",
      prompt:
        "Flex the wrist with the elbow held at its starting angle. Predict the flexor carpi radialis path change.",
    },
    {
      id: "wrist-ecrb",
      request: { coordinates: { flexion: 40 } },
      muscle: "ECRB",
      prompt:
        "Bring the palm toward the forearm. How does the extensor carpi radialis brevis path change?",
    },
    {
      id: "wrist-fcu",
      request: { coordinates: { deviation: 20 } },
      muscle: "FCU",
      prompt:
        "Move the wrist toward the little finger. Predict the flexor carpi ulnaris path change.",
    },
    {
      id: "wrist-ecu",
      request: { coordinates: { deviation: 20 } },
      muscle: "ECU",
      prompt:
        "Move the wrist toward the little finger without flexing it. Does the extensor carpi ulnaris path become longer or shorter?",
    },
  ],
  ankle: [
    {
      id: "ankle-gastroc-dorsiflexion",
      request: { coordinates: { ankle_angle_r: 20, knee_angle_r: 0 } },
      muscle: "gasmed_r",
      prompt:
        "Bring the foot toward the shin while keeping the knee straight. How does the medial gastrocnemius path change from the starting pose?",
    },
    {
      id: "ankle-gastroc-knee",
      request: { coordinates: { knee_angle_r: 90, ankle_angle_r: 0 } },
      muscle: "gaslat_r",
      prompt:
        "Bend only the knee, holding the ankle at its starting angle. Predict the lateral gastrocnemius path change, remembering that it crosses both joints.",
    },
    {
      id: "ankle-soleus",
      request: { coordinates: { ankle_angle_r: 20 } },
      muscle: "soleus_r",
      prompt:
        "Bring the foot toward the shin with the knee straight. How does the soleus path change from the starting pose?",
    },
    {
      id: "ankle-tibialis",
      request: { coordinates: { ankle_angle_r: -30 } },
      muscle: "tibant_r",
      prompt:
        "Point the foot away from the shin. Predict the tibialis anterior path change from the starting pose.",
    },
    {
      id: "ankle-fibularis",
      request: { coordinates: { subtalar_angle_r: 15 } },
      muscle: "perlong_r",
      prompt:
        "Turn the sole inward using the subtalar control. Does the fibularis longus path become longer or shorter?",
    },
    {
      id: "ankle-knee-soleus",
      request: { coordinates: { knee_angle_r: 90 } },
      muscle: "soleus_r",
      prompt:
        "Bend only the knee, leaving the ankle and subtalar angles at their starting values. What happens to the soleus path, which does not cross the knee?",
    },
  ],
  shoulder: [
    {
      id: "arm-up-pec",
      request: { coordinates: { shoulder_elv: 70, axial_rot: 0 } },
      muscle: "PectoralisMajorThorax_I",
      prompt:
        "Raise the arm with the shoulder blade held at its reference position. How does the inferior pectoralis major path change?",
    },
    {
      id: "arm-up-deltoid",
      request: { coordinates: { shoulder_elv: 70 } },
      muscle: "DeltoideusScapula_M",
      prompt:
        "Elevate the arm relative to a fixed shoulder blade. How does the middle deltoid path change?",
    },
    {
      id: "arm-up-lat",
      request: { coordinates: { shoulder_elv: 70 } },
      muscle: "LatissimusDorsi_M",
      prompt:
        "Follow the middle latissimus dorsi path as the arm rises. Does it become longer or shorter?",
    },
    {
      id: "rotation-teres",
      request: { coordinates: { shoulder_elv: 50, axial_rot: -20 } },
      muscle: "TeresMinor",
      prompt:
        "Compare this combined shoulder pose with the starting pose. How does the teres minor path change?",
    },
    ...scapularQuestions,
  ],
  hip: [
    {
      id: "hip-hamstring",
      request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 0 } },
      muscle: "bflh_r",
      prompt:
        "Flex the hip with the knee straight. Predict the length change of the long head of biceps femoris.",
    },
    {
      id: "hip-psoas",
      request: { coordinates: { hip_flexion_r: 70 } },
      muscle: "psoas_r",
      prompt:
        "Bring the thigh forward. How does the psoas path change relative to the starting pose?",
    },
    {
      id: "hip-adductor",
      request: { coordinates: { hip_adduction_r: -25 } },
      muscle: "addlong_r",
      prompt:
        "Move the thigh outward with the knee straight. Predict the adductor longus path change.",
    },
    {
      id: "combined-hamstring",
      request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 90 } },
      muscle: "bflh_r",
      prompt:
        "Combine hip flexion with a bent knee. Compare the whole biceps femoris long-head path with the starting pose.",
    },
  ],
  knee: [
    {
      id: "knee-rectus",
      request: { coordinates: { hip_flexion_r: 0, knee_angle_r: 90 } },
      muscle: "recfem_r",
      prompt:
        "Bend the knee while keeping the hip at its starting angle. What happens to the rectus femoris path?",
    },
    {
      id: "knee-vastus",
      request: { coordinates: { knee_angle_r: 90 } },
      muscle: "vaslat_r",
      prompt:
        "Bend the knee to 90°. Predict the vastus lateralis path change from the starting pose.",
    },
    {
      id: "knee-short-head",
      request: { coordinates: { knee_angle_r: 90 } },
      muscle: "bfsh_r",
      prompt:
        "Bend the knee with the hip held still. What happens to the biceps femoris short-head path?",
    },
    {
      id: "knee-combined-rectus",
      request: { coordinates: { hip_flexion_r: 70, knee_angle_r: 90 } },
      muscle: "recfem_r",
      prompt:
        "Both hip and knee are flexed. Compare the rectus femoris path with the model starting pose, accounting for both joints.",
    },
  ],
};
export const boneNames: Record<string, string> = {
  "thorax.vtp": "Rib cage",
  "groundspine.vtp": "Spine",
  "clavicle.vtp": "Clavicle",
  "scapula.vtp": "Scapula",
  "humerus.vtp": "Humerus",
  "radius.vtp": "Radius",
  "ulna.vtp": "Ulna",
  "r_pelvis.vtp": "Right hip bone",
  "l_pelvis.vtp": "Left hip bone",
  "sacrum.vtp": "Sacrum",
  "r_femur.vtp": "Femur",
  "r_tibia.vtp": "Tibia",
  "r_fibula.vtp": "Fibula",
  "r_patella.vtp": "Patella",
  "r_talus.vtp": "Talus",
  "r_foot.vtp": "Heel and midfoot (combined model mesh)",
  "r_bofoot.vtp": "Toes (combined model mesh)",
};

Object.assign(boneNames, {
  "lunate.vtp": "Lunate",
  "sdfastSCAPHOIDw.vtp": "Scaphoid",
  "sdfastPISIFORMw.vtp": "Pisiform",
  "sdfastTRIQUETRALw.vtp": "Triquetrum",
  "capitate.vtp": "Capitate",
});
for (const [file, label] of Object.entries({
  "2mc": "Second metacarpal",
  "3mc": "Third metacarpal",
  "4mc": "Fourth metacarpal",
  "5mc": "Fifth metacarpal",
  trapezium: "Trapezium",
  trapezoid: "Trapezoid",
  hamate: "Hamate",
}))
  boneNames[`sdfast_1seg_hand_fr_c_${file}.vtp`] = label;
for (const finger of [2, 3, 4, 5])
  for (const [segment, label] of Object.entries({
    proxph: "Proximal phalanx",
    midph: "Middle phalanx",
    distph: "Distal phalanx",
  }))
    boneNames[`hand_${finger}${segment}.vtp`] = `${label} · digit ${finger}`;
Object.assign(boneNames, {
  "hand_thumbprox.vtp": "Thumb proximal phalanx",
  "hand_thumbdist.vtp": "Thumb distal phalanx",
  "hand_1mc.vtp": "First metacarpal",
});

Object.assign(boneNames, {
  "skull.vtp": "Skull",
  "jaw.vtp": "Mandible",
  "tlspine.vtp": "Thoracic and lumbar spine",
  "ribcage.vtp": "Rib cage",
  "rotatedcerv7.vtp": "C7 vertebra",
  "rscapula.vtp": "Right scapula",
  "lscapula.vtp": "Left scapula",
  "rclavicle.vtp": "Right clavicle",
  "lclavicle.vtp": "Left clavicle",
});
for (let n = 1; n <= 6; n++)
  boneNames[`cerv${n}.vtp`] =
    n === 1 ? "Atlas (C1)" : n === 2 ? "Axis (C2)" : `C${n} vertebra`;

for (let n = 1; n <= 12; n++)
  boneNames[`thoracic${n}.vtp`] = `Thoracic vertebra T${n}`;
for (let n = 1; n <= 5; n++)
  boneNames[`lumbar${n}.vtp`] = `Lumbar vertebra L${n}`;
for (let n = 1; n <= 12; n++)
  for (const side of ["R", "L"])
    boneNames[`Rib${n}${side}.vtp`] =
      `${side === "R" ? "Right" : "Left"} rib ${n}`;
boneNames["sacrum.vtp"] = "Sacrum";
boneNames["Sternum.vtp"] = "Sternum";
