// Extract the existing atlas geometry in world coordinates; requires the Vite dev server.
import { chromium } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:5173");
  const meshes = await page.evaluate(async () => {
    const { GLTFLoader } =
      await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js");
    const { DRACOLoader } =
      await import("/node_modules/three/examples/jsm/loaders/DRACOLoader.js");
    const decoder = new DRACOLoader().setDecoderPath("/draco/");
    const asset = await new GLTFLoader()
      .setDRACOLoader(decoder)
      .loadAsync("/models/body.glb");
    asset.scene.updateMatrixWorld(true);
    const result = [];
    asset.scene.traverse((object) => {
      if (!object.isMesh) return;
      const name = String(object.userData.nameDetail || object.name).replaceAll(
        "_",
        " ",
      );
      if (!/^(Clavicle|Humerus|Scapula)$|Part Of Deltoid Muscle/i.test(name))
        return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const positions = Array.from(geometry.attributes.position.array);
      if (
        positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) >= 0
      )
        return;
      result.push({
        name,
        positions,
        indices: Array.from(geometry.index.array),
      });
      geometry.dispose();
    });
    decoder.dispose();
    return result;
  });
  writeFileSync(
    "public/models/deltoid/atlas.json",
    JSON.stringify({
      source: "/models/body.glb",
      sourceSha256: createHash("sha256")
        .update(readFileSync("public/models/body.glb"))
        .digest("hex"),
      license: "CC BY-SA 4.0",
      side: "right",
      meshes,
    }),
  );
  console.log(`Extracted ${meshes.length} right-sided atlas meshes.`);
} finally {
  await browser.close();
}
