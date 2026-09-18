// Vite and the native API must be running: npm run dev -- --port 5173
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:5173");
  const report = await page.evaluate(async () => {
    const { muscleAtlas, atlasUnavailable } =
      await import("/src/muscleAtlas.ts");
    const assets = {};
    for (const name of ["atlas", "bodyparts3d-tfl", "neck", "spine"])
      assets[name] = await (
        await fetch(`/models/muscle-reference/${name}.json`)
      ).json();
    const invalidMeshes = [],
      models = [];
    for (const [dataset, asset] of Object.entries(assets))
      for (const m of asset.meshes)
        if (
          !m.positions.length ||
          m.positions.length % 3 ||
          !m.indices.length ||
          m.indices.length % 3 ||
          m.positions.some((v) => !Number.isFinite(v)) ||
          m.indices.some(
            (v) => !Number.isInteger(v) || v < 0 || v >= m.positions.length / 3,
          )
        )
          invalidMeshes.push(`${dataset}: ${m.name}`);
    for (const region of ["shoulder", "hip", "arm", "neck", "spine"]) {
      const config = await (
        await fetch(`/api/biomechanics/config?region=${region}`)
      ).json();
      const unavailable = [];
      const missing = [],
        correspondences = [];
      for (const muscle of config.muscles) {
        const match = muscleAtlas[muscle.id];
        if (!match && atlasUnavailable[muscle.id]) {
          unavailable.push({
            id: muscle.id,
            name: muscle.name,
            reason: atlasUnavailable[muscle.id],
          });
          continue;
        }
        const dataset = match?.dataset || "atlas";
        const names = [...(match?.names || []), ...(match?.fasciaNames || [])];
        if (
          !match ||
          match.region !== (region === "arm" ? "shoulder" : region) ||
          !names.length ||
          names.some(
            (n) =>
              assets[dataset].meshes.filter((m) => m.name === n && !m.bone)
                .length !== 1,
          )
        )
          missing.push(muscle.name);
        correspondences.push({
          id: muscle.id,
          label: muscle.name,
          dataset,
          names,
          broaderSurface: !!match?.compartment,
        });
      }
      models.push({
        region,
        total: config.muscles.length,
        mapped: config.muscles.length - missing.length - unavailable.length,
        unavailable,
        missing,
        correspondences,
      });
    }
    const neckSurfaces = [...assets.neck.meshes, ...assets.spine.meshes].filter(
      (m) => !m.bone,
    );
    for (const m of neckSurfaces) {
      const meanX =
        m.positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) /
        (m.positions.length / 3);
      if (
        !(m.name.startsWith("Right ")
          ? meanX < 0
          : m.name.startsWith("Left ") && meanX > 0)
      )
        invalidMeshes.push(`neck side: ${m.name}`);
    }
    return {
      sourceSha256: assets.atlas.sourceSha256,
      regions: Object.values(assets)
        .flatMap((a) => a.meshes)
        .filter((m) => !m.bone && !m.fascia).length,
      fasciaSurfaces: 1,
      supplementSources: assets["bodyparts3d-tfl"].sources,
      models,
      invalidMeshes,
    };
  });
  writeFileSync(
    "biomechanics/reports/muscle-atlas-coverage.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (
    report.invalidMeshes.length ||
    report.models.some((m) => m.missing.length)
  )
    throw Error(
      "Reference coverage audit failed; see biomechanics/reports/muscle-atlas-coverage.json",
    );
  console.log(
    report.models.map((m) => `${m.region}: ${m.mapped}/${m.total}`).join(", "),
  );
} finally {
  await browser.close();
}
