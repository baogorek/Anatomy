// Rebuild coverage from the bundled atlas and exposed native configurations.
// Run with the studio on port 5173. No name-based guesses about missing muscles.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const bytes = readFileSync("public/models/body.glb");
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const names = [
  ...new Set(
    gltf.nodes
      .filter((n) => n.extras?.type === "muscle")
      .map((n) => n.extras.nameDetail.replaceAll("_", " ")),
  ),
].sort();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:5173");
  const data = await page.evaluate(async (names) => {
    const { muscleAtlas } = await import("/src/muscleAtlas.ts");
    const regions = ["shoulder", "arm", "hip", "neck", "spine", "wholebody"];
    const configs = [];
    for (const region of regions) {
      const r = await fetch(`/api/biomechanics/config?region=${region}`);
      if (!r.ok) throw Error(`Cannot audit ${region}`);
      configs.push(await r.json());
    }
    const normalize = (name) =>
      name.replace(/^(Right|Left) /, "").toLowerCase();
    // Cross-source anatomical identity only. This does not register the surfaces
    // to another model or transfer lengths/attachment points between models.
    const leg = {
      glut_med1: "glmed1",
      glut_med2: "glmed2",
      glut_med3: "glmed3",
      bifemlh: "bflh",
      bifemsh: "bfsh",
      sar: "sart",
      add_mag2: "addmagMid",
      tfl: "tfl",
      pect: "pect",
      grac: "grac",
      glut_max1: "glmax1",
      glut_max2: "glmax2",
      glut_max3: "glmax3",
      iliacus: "iliacus",
      quad_fem: "quadfem",
      gem: "gem",
      peri: "piri",
      rect_fem: "recfem",
      vas_int: "vasint",
      med_gas: "gasmed",
      soleus: "soleus",
      tib_post: "tibpost",
      tib_ant: "tibant",
    };
    const entries = names.map((name) => ({ name, paths: [] }));
    // These named whole-body muscles are absent from the exposed hip model.
    // Gemelli is one combined native path, linked to its two atlas muscles.
    const wholeBodyOnly = {
      pect: ["Pectineus Muscle"],
      quad_fem: ["Quadratus Femoris Muscle"],
      gem: ["Superior Gemellus Muscle", "Inferior Gemellus Muscle"],
    };
    for (const c of configs)
      for (const muscle of c.muscles) {
        let match = muscleAtlas[muscle.id];
        if (c.region === "wholebody") {
          match = muscleAtlas[muscle.id.replace("wholebody__", "spine__")];
          const stem = muscle.id
            .replace("wholebody__", "")
            .replace(/_[rl]$/, "");
          if (!match && leg[stem]) match = muscleAtlas[`${leg[stem]}_r`];
          if (!match && wholeBodyOnly[stem])
            match = { names: wholeBodyOnly[stem] };
        }
        if (!match) continue;
        const side = /^(Right|Left) /.exec(muscle.name)?.[1] || c.side;
        for (const entry of entries)
          if (match.names.some((n) => normalize(n) === normalize(entry.name))) {
            entry.paths.push({
              region: c.region,
              id: muscle.id,
              name: /^(Right|Left) /.test(muscle.name)
                ? muscle.name
                : `${side} ${muscle.name}`,
            });
          }
      }
    return {
      entries,
      models: configs.map((c) => ({
        region: c.region,
        modelVersion: c.modelVersion,
        pathCount: c.muscles.length,
      })),
    };
  }, names);
  writeFileSync(
    "src/anatomyCatalog.json",
    JSON.stringify(
      {
        schema: 1,
        atlasSha256: createHash("sha256").update(bytes).digest("hex"),
        ...data,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${data.entries.length} named atlas structures; ${data.entries.filter((e) => e.paths.length).length} with linked movement paths.`,
  );
} finally {
  await browser.close();
}
