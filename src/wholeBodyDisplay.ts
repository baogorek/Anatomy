import spineMuscles from "../biomechanics/models/spine/muscles.json";
import type { ModelConfig } from "./biomechanics";

// Display groups, not exclusive anatomical depth planes. Membership is explicit;
// the source inventory supplies the muscle family and side of each spinal path.
export const bodyLayers = [
  {
    id: "back",
    label: "Deep back",
    families: [
      "Multifidus lumborum",
      "Multifidus thoracis",
      "Multifidus",
      "Longissimus thoracis",
      "Iliocostalis lumborum",
    ],
  },
  {
    id: "abdomen",
    label: "Abdominal wall",
    families: [
      "Rectus abdominis",
      "External abdominal oblique",
      "Internal abdominal oblique",
      "Transversus abdominis",
      "Quadratus lumborum",
    ],
  },
  {
    id: "ribs",
    label: "Rib muscles",
    families: ["External intercostals", "Internal intercostals"],
  },
  {
    id: "neck",
    label: "Neck",
    families: [
      "Sternocleidomastoid",
      "Anterior scalene",
      "Middle scalene",
      "Posterior scalene",
      "Longus colli",
      "Splenius capitis",
      "Splenius cervicis",
      "Semispinalis capitis",
      "Semispinalis cervicis",
      "Longissimus cervicis",
      "Iliocostalis cervicis",
    ],
  },
  {
    id: "shoulder",
    label: "Shoulders & upper back",
    families: [
      "Latissimus dorsi",
      "Trapezius",
      "Levator scapulae",
      "Serratus anterior",
      "Deltoid",
      "Supraspinatus",
      "Infraspinatus",
      "Subscapularis",
      "Teres minor",
      "Teres major",
      "Pectoralis major",
      "Coracobrachialis",
    ],
  },
  {
    id: "hip",
    label: "Hip & thigh",
    families: [
      "Psoas major",
      "Gluteus medius",
      "Gluteus maximus",
      "Biceps femoris",
      "Sartorius",
      "Adductor magnus",
      "Tensor fasciae latae",
      "Pectineus",
      "Gracilis",
      "Iliacus",
      "Quadratus femoris",
      "Gemelli",
      "Piriformis",
      "Rectus femoris",
      "Vastus intermedius",
    ],
  },
  {
    id: "leg",
    label: "Lower leg",
    families: [
      "Gastrocnemius",
      "Soleus",
      "Tibialis posterior",
      "Tibialis anterior",
    ],
  },
] as const;

export type BodyLayer = (typeof bodyLayers)[number]["id"];
export type PathMode = "muscle" | "region" | "all";
export type PathSide = "selected" | "both" | "Right" | "Left";
export type BodyMuscle = {
  id: string;
  family: string;
  side: "Right" | "Left";
  layer?: BodyLayer;
};
export type PathAppearance = {
  mode: PathMode;
  side: PathSide;
  layers: BodyLayer[];
  boneOpacity: number;
  markers: boolean;
};
export const defaultAppearance: PathAppearance = {
  mode: "muscle",
  side: "selected",
  layers: [],
  boneOpacity: 1,
  markers: false,
};

const source = new Map(
  spineMuscles.map((m) => ["wholebody__" + m.nativeId, m]),
);
const lowerFamilies: Record<string, string> = {
  bifemlh: "Biceps femoris",
  bifemsh: "Biceps femoris",
  sar: "Sartorius",
  add_mag2: "Adductor magnus",
  tfl: "Tensor fasciae latae",
  pect: "Pectineus",
  grac: "Gracilis",
  iliacus: "Iliacus",
  quad_fem: "Quadratus femoris",
  gem: "Gemelli",
  peri: "Piriformis",
  rect_fem: "Rectus femoris",
  vas_int: "Vastus intermedius",
  med_gas: "Gastrocnemius",
  soleus: "Soleus",
  tib_post: "Tibialis posterior",
  tib_ant: "Tibialis anterior",
};
for (let i = 1; i <= 3; i++) {
  lowerFamilies[`glut_med${i}`] = "Gluteus medius";
  lowerFamilies[`glut_max${i}`] = "Gluteus maximus";
}

export function wholeBodyMuscles(
  muscles: ModelConfig["muscles"],
): BodyMuscle[] {
  return muscles.map((m) => {
    const entry = source.get(m.id);
    const lower = /^wholebody__(.+)_(r|l)$/.exec(m.id);
    const family =
      entry?.family || (lower && lowerFamilies[lower[1]]) || m.name;
    const side =
      entry?.side === "Left" || (!entry && lower?.[2] === "l")
        ? "Left"
        : "Right";
    return {
      id: m.id,
      family,
      side,
      layer: bodyLayers.find((l) =>
        (l.families as readonly string[]).includes(family),
      )?.id,
    };
  });
}

export function visibleBodyPaths(
  muscles: BodyMuscle[],
  selected: string,
  appearance: PathAppearance,
): Set<string> {
  const active = muscles.find((m) => m.id === selected);
  const side = appearance.side === "selected" ? active?.side : appearance.side;
  return new Set(
    muscles
      .filter((m) => {
        // Keep the highlighted result findable even when context is filtered away.
        if (m.id === selected) return true;
        if (side !== "both" && m.side !== side) return false;
        if (appearance.mode === "all") return true;
        if (m.family === active?.family) return true;
        return (
          appearance.mode === "region" &&
          !!m.layer &&
          appearance.layers.includes(m.layer)
        );
      })
      .map((m) => m.id),
  );
}
