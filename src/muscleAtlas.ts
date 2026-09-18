import spineAtlas from "./spineAtlas.json";
export type AtlasMatch = {
  label: string;
  names: string[];
  compartment?: boolean;
  region: "shoulder" | "hip" | "neck" | "spine";
  dataset?: "bodyparts3d-tfl" | "neck" | "spine";
  fasciaNames?: string[];
};
const shoulder = (
  label: string,
  names: string[],
  compartment = false,
): AtlasMatch => ({ label, names, compartment, region: "shoulder" });
const hip = (label: string, name: string, compartment = false): AtlasMatch => ({
  label,
  names: [name],
  compartment,
  region: "hip",
});
export const muscleAtlas: Record<string, AtlasMatch> = {
  gasmed_r: hip("Gastrocnemius · medial head", "Medial Head Of Gastrocnemius"),
  gaslat_r: hip(
    "Gastrocnemius · lateral head",
    "Lateral Head Of Gastrocnemius",
  ),
  soleus_r: hip("Soleus", "Soleus Muscle"),
  tibant_r: hip("Tibialis anterior", "Tibialis Anterior Muscle"),
  tibpost_r: hip("Tibialis posterior", "Tibialis Posterior Muscle"),
  perlong_r: hip("Fibularis longus", "Fibularis Longus Muscle"),
  perbrev_r: hip("Fibularis brevis", "Fibularis Brevis Muscle"),
  edl_r: hip("Extensor digitorum longus", "Extensor Digitorum Longus"),
  ehl_r: hip("Extensor hallucis longus", "Extensor Hallucis Longus"),
  fdl_r: hip("Flexor digitorum longus", "Flexor Digitorum Longus"),
  fhl_r: hip("Flexor hallucis longus", "Flexor Hallucis Longus"),
  DeltoideusClavicle_A: shoulder("Anterior deltoid", [
    "Clavicular Part Of Deltoid Muscle",
  ]),
  DeltoideusScapula_M: shoulder("Middle deltoid", [
    "Acromial Part Of Deltoid Muscle",
  ]),
  DeltoideusScapula_P: shoulder("Posterior deltoid", [
    "Scapular Spinal Part Of Deltoid Muscle",
  ]),
  LevatorScapulae: shoulder("Levator scapulae", ["Levator Scapulae"]),
  Coracobrachialis: shoulder("Coracobrachialis", ["Coracobrachialis Muscle"]),
  PectoralisMajorClavicle_S: shoulder(
    "Pectoralis major · clavicular head",
    ["Clavicular Head Of Pectoralis Major Muscle"],
    true,
  ),
  PectoralisMinor: shoulder("Pectoralis minor", ["Pectoralis Minor Muscle"]),
  TeresMajor: shoulder("Teres major", ["Teres Major Muscle"]),
  TeresMinor: shoulder("Teres minor", ["Teres Minor Muscle"]),
  TRIlong: shoulder("Triceps · long head", ["Long Head Of Triceps Brachii"]),
  BIC_long: shoulder("Biceps brachii · long head", [
    "Long Head Of Biceps Brachii",
  ]),
  BIC_brevis: shoulder("Biceps brachii · short head", [
    "Short Head Of Biceps Brachii",
  ]),
  bflh_r: hip("Biceps femoris · long head", "Long Head Of Biceps Femoris"),
  bfsh_r: hip("Biceps femoris · short head", "Short Head Of Biceps Femoris"),
  recfem_r: hip("Rectus femoris", "Rectus Femoris Muscle"),
  vaslat_r: hip("Vastus lateralis", "Vastus Lateralis Muscle"),
  vasmed_r: hip("Vastus medialis", "Vastus Medialis Muscle"),
  vasint_r: hip("Vastus intermedius", "Vastus Intermedius Muscle"),
  psoas_r: hip("Psoas major", "Psoas Major"),
  iliacus_r: hip("Iliacus", "Iliacus Muscle"),
  piri_r: hip("Piriformis", "Piriformis Muscle"),
  sart_r: hip("Sartorius", "Sartorius Muscle"),
  grac_r: hip("Gracilis", "Gracilis Muscle"),
  semimem_r: hip("Semimembranosus", "Semimembranosus Muscle"),
  semiten_r: hip("Semitendinosus", "Semitendinosus Muscle"),
  addlong_r: hip("Adductor longus", "Adductor Longus"),
  addbrev_r: hip("Adductor brevis", "Adductor Brevis"),
  tfl_r: {
    label: "Tensor fasciae latae",
    names: ["Right tensor fasciae latae"],
    fasciaNames: ["Right iliotibial tract"],
    region: "hip",
    dataset: "bodyparts3d-tfl",
  },
};
for (const id of [
  "TrapeziusScapula_M",
  "TrapeziusScapula_S",
  "TrapeziusScapula_I",
  "TrapeziusClavicle_S",
])
  muscleAtlas[id] = shoulder(
    "Trapezius",
    [
      "Ascending Part Of Trapezius Muscle",
      "Descending Part Of Trapezius Muscle",
      "Transverse Part Of Trapezius Muscle",
    ],
    true,
  );
for (const suffix of ["I", "M", "S"]) {
  muscleAtlas[`SerratusAnterior_${suffix}`] = shoulder(
    "Serratus anterior",
    ["Serratus Anterior Muscle"],
    true,
  );
  muscleAtlas[`LatissimusDorsi_${suffix}`] = shoulder(
    "Latissimus dorsi",
    ["Latissimus Dorsi Muscle"],
    true,
  );
  muscleAtlas[`Subscapularis_${suffix}`] = shoulder(
    "Subscapularis",
    ["Subscapularis Muscle"],
    true,
  );
}
for (const suffix of ["I", "S"]) {
  muscleAtlas[`Rhomboideus_${suffix}`] = shoulder(
    "Rhomboid major and minor",
    ["Rhomboid Major Muscle", "Rhomboid Minor Muscle"],
    true,
  );
  muscleAtlas[`Infraspinatus_${suffix}`] = shoulder(
    "Infraspinatus",
    ["Infraspinatus Muscle"],
    true,
  );
}
for (const suffix of ["I", "M"])
  muscleAtlas[`PectoralisMajorThorax_${suffix}`] = shoulder(
    "Pectoralis major · sternocostal head",
    ["Sternocostal Head Of Pectoralis Major Muscle"],
    true,
  );
for (const suffix of ["A", "P"])
  muscleAtlas[`Supraspinatus_${suffix}`] = shoulder(
    "Supraspinatus",
    ["Supraspinatus Muscle"],
    true,
  );
for (const [stem, label, name] of [
  ["glmax", "Gluteus maximus", "Gluteus Maximus Muscle"],
  ["glmed", "Gluteus medius", "Gluteus Medius Muscle"],
  ["glmin", "Gluteus minimus", "Gluteus Minimus Muscle"],
])
  for (const i of [1, 2, 3])
    muscleAtlas[`${stem}${i}_r`] = hip(label, name, true);
for (const suffix of ["Dist", "Isch", "Mid", "Prox"])
  muscleAtlas[`addmag${suffix}_r`] = hip(
    "Adductor magnus",
    "Adductor Magnus",
    true,
  );
export type AtlasMesh = {
  name: string;
  positions: number[];
  indices: number[];
  bone: boolean;
  fascia?: boolean;
  region: "shoulder" | "hip" | "neck" | "spine" | "both";
};
export type MuscleAtlasAsset = {
  schema: number;
  dataset?: "bodyparts3d-tfl" | "neck" | "spine";
  meshes: AtlasMesh[];
  sourceSha256: string;
  missingNames: string[];
};

for (const [id, label, names] of [
  ["TRIlat", "Triceps · lateral head", ["Lateral Head Of Triceps Brachii"]],
  ["TRImed", "Triceps · medial head", ["Medial Head Of Triceps Brachii"]],
  ["BIClong", "Biceps · long head", ["Long Head Of Biceps Brachii"]],
  ["BICshort", "Biceps · short head", ["Short Head Of Biceps Brachii"]],
  ["BRA", "Brachialis", ["Brachialis Muscle"]],
  ["BRD", "Brachioradialis", ["Brachioradialis Muscle"]],
  ["ANC", "Anconeus", ["Anconeus Muscle"]],
  ["SUP", "Supinator", ["Supinator"]],
  [
    "PT",
    "Pronator teres",
    ["Superficial Head Of Pronator Teres", "Deep Head Of Pronator Teres"],
  ],
  ["PQ", "Pronator quadratus", ["Pronator Quadratus"]],
  [
    "ECRL",
    "Extensor carpi radialis longus",
    ["Extensor Carpi Radialis Longus"],
  ],
  [
    "ECRB",
    "Extensor carpi radialis brevis",
    ["Extensor Carpi Radialis Brevis"],
  ],
  [
    "ECU",
    "Extensor carpi ulnaris",
    [
      "Humeral Head Of Extensor Carpi Ulnaris",
      "Ulnar Head Of Extensor Carpi Ulnaris",
    ],
  ],
  ["FCR", "Flexor carpi radialis", ["Flexor Carpi Radialis"]],
  [
    "FCU",
    "Flexor carpi ulnaris",
    [
      "Humeral Head Of Flexor Carpi Ulnaris",
      "Ulnar Head Of Flexor Carpi Ulnaris",
    ],
  ],
  ["PL", "Palmaris longus", ["Palmaris Longus Muscle"]],
] as [string, string, string[]][])
  muscleAtlas[id] = shoulder(label, names);

const neckNames: Record<string, [string, string, boolean?]> = {
  stern_mast: [
    "SCM · sternal–mastoid compartment",
    "Sternocleidomastoid Muscle",
    true,
  ],
  cleid_mast: [
    "SCM · clavicular–mastoid compartment",
    "Sternocleidomastoid Muscle",
    true,
  ],
  cleid_occ: [
    "SCM · clavicular–occipital compartment",
    "Sternocleidomastoid Muscle",
    true,
  ],
  scalenus_ant: ["Anterior scalene", "Scalenus Anterior Muscle"],
  scalenus_med: ["Middle scalene", "Scalenus Medius Muscle"],
  scalenus_post: ["Posterior scalene", "Scalenus Posterior Muscle"],
  long_cap_sklc4: ["Longus capitis", "Longus Capitis Muscle"],
  long_col_c1thx: [
    "Longus colli · C1–thorax compartment",
    "Longus Colli Muscle",
    true,
  ],
  long_col_c1c5: [
    "Longus colli · C1–C5 compartment",
    "Longus Colli Muscle",
    true,
  ],
  long_col_c5thx: [
    "Longus colli · C5–thorax compartment",
    "Longus Colli Muscle",
    true,
  ],
  trap_cl: [
    "Trapezius · clavicular compartment",
    "Descending Part Of Trapezius Muscle",
    true,
  ],
  trap_acr: [
    "Trapezius · acromial compartment",
    "Descending Part Of Trapezius Muscle",
    true,
  ],
  splen_cap_sklc6: [
    "Splenius capitis · skull–C6 compartment",
    "Splenius Capitis Muscle",
    true,
  ],
  splen_cap_sklthx: [
    "Splenius capitis · skull–thorax compartment",
    "Splenius Capitis Muscle",
    true,
  ],
  splen_cerv_c3thx: ["Splenius cervicis", "Splenius Colli Muscle"],
  semi_cerv_c3thx: ["Semispinalis cervicis", "Semispinalis Colli Muscle"],
  levator_scap: ["Levator scapulae", "Levator Scapulae"],
  longissi_cap_sklc6: ["Longissimus capitis", "Longissimus Capitis Muscle"],
  longissi_cerv_c4thx: ["Longissimus cervicis", "Longissimus Colli Muscle"],
  iliocost_cerv_c5rib: ["Iliocostalis cervicis", "Iliocostalis Colli Muscle"],
  rectcap_post_maj: [
    "Rectus capitis posterior major",
    "Rectus Posterior Major Capitis Muscle",
  ],
  rectcap_post_min: [
    "Rectus capitis posterior minor",
    "Rectus Posterior Minor Capitis Muscle",
  ],
  obl_cap_sup: [
    "Obliquus capitis superior",
    "Obliquus Superior Capitis Muscle",
  ],
  obl_cap_inf: [
    "Obliquus capitis inferior",
    "Obliquus Inferior Capitis Muscle",
  ],
};
for (const [stem, [label, name, compartment]] of Object.entries(neckNames))
  for (const [suffix, side] of [
    ["", "Right"],
    ["_L", "Left"],
  ])
    muscleAtlas[stem + suffix] = {
      label: `${side} ${label}`,
      names: [`${side} ${name}`],
      compartment,
      region: "neck",
      dataset: "neck",
    };
export const atlasUnavailable: Record<string, string> = {};
for (const stem of ["semi_cap_sklc5", "semi_cap_sklthx"])
  for (const suffix of ["", "_L"])
    atlasUnavailable[stem + suffix] =
      "The bundled atlas has no matching semispinalis capitis surface. Spinalis capitis is a different named structure and is not substituted. The native model path remains inspectable in the movement view.";

Object.assign(muscleAtlas, spineAtlas);
for (const id of ["spine__semi_cap_sklthx", "spine__semi_cap_sklthx_L"])
  atlasUnavailable[id] =
    "The source atlas has no semispinalis capitis surface. Its native model path remains available.";
