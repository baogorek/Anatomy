// Bilateral, unregistered spine reference meshes, extracted without fitting.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
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
        .filter((m) => m.dataset === "spine")
        .flatMap((m) => m.names),
    );
    const bones = new Set([
      "Atlas (C1)",
      "Axis (C2)",
      "Occipital Bone",
      "Temporal Bone",
      "Parietal Bone",
      "Frontal Bone",
      "Sphenoid Bone",
      "Ethmoid Bone",
      "Zygomatic Bone",
      "Maxilla",
      "Mandible",
      "Clavicle",
      "Scapula",
      "Sternum",
      "Sacrum",
      "Hip Bone",
      "Femur",
    ]);
    const meshes = [];
    asset.scene.traverse((o) => {
      if (!o.isMesh) return;
      const original = String(o.userData.nameDetail || o.name).replaceAll(
        "_",
        " ",
      );
      const bone =
        bones.has(original) ||
        /^Vertebra [CTL]/.test(original) ||
        /^\w+ Rib$/.test(original);
      if (
        !bone &&
        !names.has(`Right ${original}`) &&
        !names.has(`Left ${original}`)
      )
        return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const positions = Array.from(g.attributes.position.array);
      const meanX =
        positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) /
        (positions.length / 3);
      const side = meanX < 0 ? "Right" : "Left";
      const name = bone ? original : `${side} ${original}`;
      meshes.push({
        name,
        originalName: original,
        side: bone ? undefined : side,
        positions,
        indices: Array.from(g.index.array),
        bone,
        region: "spine",
      });
      g.dispose();
    });
    decoder.dispose();
    return {
      meshes,
      missingNames: [...names].filter(
        (n) => meshes.filter((m) => !m.bone && m.name === n).length !== 1,
      ),
    };
  });
  if (data.missingNames.length)
    throw Error(
      `Missing or duplicate spine surfaces: ${data.missingNames.join(", ")}`,
    );
  writeFileSync(
    "public/models/muscle-reference/spine.json",
    JSON.stringify({
      schema: 1,
      dataset: "spine",
      ...data,
      sourceSha256: createHash("sha256")
        .update(readFileSync("public/models/body.glb"))
        .digest("hex"),
    }),
  );
  console.log(
    `Spine atlas: ${data.meshes.filter((m) => !m.bone).length} bilateral muscle surfaces; ${data.meshes.filter((m) => m.bone).length} source bone meshes.`,
  );
} finally {
  await browser.close();
}
