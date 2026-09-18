// Export unchanged right-sided reference meshes from the bundled atlas. Vite must be running.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:5173");
  const data = await page.evaluate(async () => {
    const { muscleAtlas } = await import("/src/muscleAtlas.ts");
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { DRACOLoader } =
      await import("/node_modules/three/examples/jsm/loaders/DRACOLoader.js");
    const decoder = new DRACOLoader().setDecoderPath("/draco/");
    const asset = await new GLTFLoader()
      .setDRACOLoader(decoder)
      .loadAsync("/models/body.glb");
    asset.scene.updateMatrixWorld(true);
    const names = new Set(
      Object.values(muscleAtlas)
        .filter((m) => !m.dataset)
        .flatMap((m) => m.names),
    );
    const shoulderBones = [
      "Clavicle",
      "Scapula",
      "Humerus",
      "Radius",
      "Ulna",
      "Capitate Bone",
      "Hamate Bone",
      "Lunate Bone",
      "Pisiform Bone",
      "Scaphoid Bone",
      "Trapezium Bone",
      "Trapezoid Bone",
      "Triquetrum Bone",
      ...["First", "Second", "Third", "Fourth", "Fifth"].map(
        (n) => `${n} Metacarpal Bone`,
      ),
    ];
    const hipBones = [
      "Hip Bone",
      "Sacrum",
      "Femur",
      "Tibia",
      "Fibula",
      "Patella",
      "Talus",
      "Calcaneus",
      "Navicular Bone",
      "Cuboid Bone",
      "Intermediate Cuneiform Bone",
      "Lateral Cuneiform Bone",
      "Medial Cuneiform Bone",
      "First Metatarsal Bone",
      "Second Metatarsal Bone",
      "Third Metatarsal Bone",
      "Fourth Metatarsal Bone",
      "Fifth Metatarsal Bone",
    ];
    const meshes = [];
    asset.scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = String(o.userData.nameDetail || o.name).replaceAll("_", " ");
      const spine = /^Vertebra [TL]/.test(name),
        rib = /^\w+ Rib$/.test(name);
      const bone =
        shoulderBones.includes(name) ||
        /Phalanx.*Of Hand/.test(name) ||
        hipBones.includes(name) ||
        spine ||
        rib;
      if (!bone && !names.has(name)) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const positions = Array.from(g.attributes.position.array);
      const meanX =
        positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) /
        (positions.length / 3);
      if (meanX >= 0 && !spine && name !== "Sacrum") {
        g.dispose();
        return;
      }
      const match = Object.values(muscleAtlas).find((m) =>
        m.names.includes(name),
      );
      const region = spine
        ? "both"
        : hipBones.includes(name)
          ? "hip"
          : bone
            ? "shoulder"
            : match.region;
      meshes.push({
        name,
        positions,
        indices: Array.from(g.index.array),
        bone,
        region,
      });
      g.dispose();
    });
    decoder.dispose();
    return {
      meshes,
      missingNames: [...names].filter((n) => !meshes.some((m) => m.name === n)),
    };
  });
  if (data.missingNames.length)
    throw new Error(
      `Missing mapped atlas muscles: ${data.missingNames.join(", ")}`,
    );
  mkdirSync("public/models/muscle-reference", { recursive: true });
  writeFileSync(
    "public/models/muscle-reference/atlas.json",
    JSON.stringify({
      schema: 1,
      ...data,
      sourceSha256: createHash("sha256")
        .update(readFileSync("public/models/body.glb"))
        .digest("hex"),
    }),
  );
  console.log(
    `Exported ${data.meshes.filter((m) => !m.bone).length} muscle/head regions and ${data.meshes.filter((m) => m.bone).length} bone meshes.`,
  );
} finally {
  await browser.close();
}
