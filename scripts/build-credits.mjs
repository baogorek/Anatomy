import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(root + path);
const json = (path) => JSON.parse(read(path));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const catalog = json("credits/catalog.json");
const papers = json("credits/publications.json");
const models = json("biomechanics/models/manifest.json");
const runtime = json("biomechanics/runtime-manifest.json");
const reading = json("src/learningSources.json");
const byDoi = new Map(papers.map((p) => [p.doi, p]));
const output = root + "public/credits/";
const check = process.argv.includes("--check");
if (!check) mkdirSync(output + "notices", { recursive: true });

function emit(path, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (check) {
    if (!readFileSync(output + path).equals(bytes))
      throw Error(`Stale credits: ${path}. Run npm run credits.`);
  } else writeFileSync(output + path, bytes);
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
function link(label, url) {
  if (/\s/.test(url) || !/^(https:\/\/|\.\.\/|notices\/|#)/.test(url))
    throw Error(`Invalid credits link: ${url}`);
  return `<a href="${esc(url)}">${esc(label)}</a>`;
}
const list = (items) =>
  `<ul>${items.map((s) => `<li>${s}</li>`).join("")}</ul>`;
const repoUrl = (m) =>
  m.sourceUrl || `https://github.com/${m.repository}/tree/${m.commit}`;
const paragraph = (label, text) =>
  `<p><strong>${label}</strong> ${esc(text)}</p>`;
const noticeRecords = [];
function notice(n) {
  const data = read(n.source);
  emit("notices/" + n.file, data);
  noticeRecords.push({ ...n, sha256: hash(data) });
  return link(n.label, "notices/" + n.file);
}

// A new native model must receive explicit credits before it can be published.
for (const key of Object.keys(models)) {
  if (!catalog.entries.some((e) => e.model === key))
    throw Error(`Missing model credits: ${key}`);
}
const ids = catalog.entries.flatMap((e) => [e.id, ...(e.aliases || [])]);
if (ids.length !== new Set(ids).size) throw Error("Duplicate credits anchors");
for (const entry of catalog.entries) {
  for (const doi of entry.publications) {
    if (!byDoi.has(doi)) throw Error(`Missing publication: ${doi}`);
  }
}

const sections = catalog.entries
  .map((e) => {
    const m = e.model && models[e.model];
    const source = m
      ? `<details><summary>Exact source and version</summary>
    ${list([
      link(m.repository, repoUrl(m)),
      `<strong>Commit:</strong> <code>${esc(m.commit)}</code>`,
      `<strong>File:</strong> <code>${esc(m.file)}</code>`,
      `<strong>Model SHA-256:</strong> <code>${esc(m.sha256)}</code>`,
      ...(m.sourceSha256
        ? [
            `<strong>Original SHA-256:</strong> <code>${esc(m.sourceSha256)}</code>`,
          ]
        : []),
      ...(m.mirrorNote ? [esc(m.mirrorNote)] : []),
      ...(m.geometrySource
        ? [
            link("Pinned bone-geometry source", repoUrl(m.geometrySource)),
            "Individual geometry paths and checksums are included in the downloadable provenance record.",
          ]
        : []),
    ])}</details>`
      : "";
    const references = e.publications.map((doi) => {
      const p = byDoi.get(doi);
      return `${esc(p.authors)} (${esc(p.year)}). ${link(p.title, p.url)} <em>${esc(p.journal)}</em> ${esc(p.volume)}${p.issue ? `(${esc(p.issue)})` : ""}: ${esc(p.pages)}. ${link("DOI: " + p.doi, p.url)}`;
    });
    const native =
      e.id === "opensim"
        ? `<details><summary>Native build identity</summary>
    <p>${esc(runtime.native.packageVersion)} · NumPy ${esc(runtime.native.numpyVersion)}</p>
    <p>${link("Pinned OpenSim source", `${runtime.provenance.source}/tree/${runtime.provenance.commit}`)}</p>
    <p>Calculation build: <code>${esc(runtime.native.id)}</code></p>
    <p>The complete runtime manifest and wheel hash are in the provenance download.</p></details>`
        : "";
    return `<section id="${e.id}">${(e.aliases || []).map((id) => `<span id="${id}"></span>`).join("")}
    <h2>${esc(e.title)}</h2><p class="credit">${esc(e.credit)}</p>
    ${paragraph("Used here.", e.use)}${paragraph("Our changes.", e.changes)}
    ${references.length ? `<h3>Publications</h3>${list(references)}` : ""}
    <h3>Sources and terms</h3><p>${esc(e.terms)}</p>
    ${list([...e.links.map((l) => link(l.label, l.url)), ...e.notices.map(notice)])}
    ${source}${native}</section>`;
  })
  .join("\n");

const frontend = [
  ["react", "React", "https://react.dev/"],
  ["react-dom", "React DOM", "https://react.dev/"],
  ["scheduler", "React Scheduler", "https://github.com/facebook/react"],
  ["three", "Three.js", "https://threejs.org/"],
  ["lucide-react", "Lucide icons", "https://lucide.dev/"],
].map(([pkg, title, url]) => {
  const metadata = json(`node_modules/${pkg}/package.json`);
  const terms = notice({
    label: `${title} license and copyright`,
    source: `node_modules/${pkg}/LICENSE`,
    file: `${pkg}-LICENSE.txt`,
  });
  return `${link(title, url)} ${esc(metadata.version)} — ${terms}`;
});
frontend.push(
  notice({
    label: "Google Draco decoder license",
    source: "public/draco/LICENSE",
    file: "draco-LICENSE.txt",
  }),
);
const software = `<section id="software"><h2>Browser software, fonts and identity</h2>
  <p>The interface uses the following projects. Full distributed notices retain their contributors’ copyrights.</p>
  ${list(frontend)}
  <p>DM Sans and Manrope load from Google Fonts with system-font fallbacks. Font authors and license notices:
    ${link("DM Sans", "https://github.com/google/fonts/tree/main/ofl/dmsans")} ·
    ${link("Manrope", "https://github.com/google/fonts/tree/main/ofl/manrope")}.</p>
  <p>The SplineFitness name and spline symbol come from the existing SplineFitness project. The header symbol preserves its original curves and nodes, with the wordmark omitted and the view box cropped.</p></section>`;

const guidance = `<section id="reading"><h2>Anatomy and movement references</h2>
  <p>These support the app’s anatomical explanations and illustrative exercise context. They are distinct from the research-model sources used to calculate path lengths. Textbooks and exercise guidance do not validate arbitrary slider poses or the longest-path search as a stretching program.</p>
  ${list([
    ...Object.values(reading).map((s) => link(s.name, s.url)),
    link(
      "UAMS · Muscles of the back region (display-group anatomy)",
      "https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-back-region/",
    ),
  ])}</section>`;

const style = read("credits/page.css").toString();
emit(
  "index.html",
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Model authors, research publications, licenses and local adaptations for SplineFitness Movement Lab.">
<title>Sources &amp; model credits — SplineFitness Movement Lab</title><style>${style}</style></head>
<body><a class="skip" href="#main">Skip to credits</a><header><a href="../">← Movement Lab</a><span>SplineFitness</span></header>
<main id="main"><h1>${esc(catalog.title)}</h1><p>${esc(catalog.introduction)}</p>
<nav aria-label="Credit sections">${list([...catalog.entries.map((e) => link(e.title, "#" + e.id)), link("Software and fonts", "#software"), link("Anatomy references", "#reading")])}</nav>
<p>${esc(catalog.interpretation)}</p>
<p class="downloads"><a href="references.ris" download>Download bibliography (RIS)</a> · <a href="provenance.json" download>Download source and version record (JSON)</a></p>
${sections}${software}${guidance}
<footer>Credits describe the exact sources and adaptations in this build. Model papers and their authors do not endorse this application.<br><a href="../">Return to Movement Lab</a></footer></main></body></html>\n`,
);

emit(
  "references.ris",
  papers
    .map((p) =>
      [
        "TY  - JOUR",
        ...p.authors
          .replace(/\.$/, "")
          .split(", ")
          .map((a) => `AU  - ${a.replace(/ ([A-Z]+)$/, ", $1")}`),
        `PY  - ${p.year}`,
        `TI  - ${p.title}`,
        `JO  - ${p.journal}`,
        `VL  - ${p.volume}`,
        ...(p.issue ? [`IS  - ${p.issue}`] : []),
        `SP  - ${p.pages}`,
        `DO  - ${p.doi}`,
        `UR  - ${p.url}`,
        "ER  -",
        "",
      ].join("\n"),
    )
    .join("\n"),
);

const assets = [
  "public/models/body.glb",
  "public/models/ATTRIBUTION.md",
  "public/models/muscle-reference/ATTRIBUTION.md",
  "public/models/deltoid/ATTRIBUTION.md",
  "public/spline-mark.svg",
];
emit(
  "provenance.json",
  JSON.stringify(
    {
      product: "SplineFitness Movement Lab",
      models,
      runtime,
      modelAssetChecksums: json("biomechanics/models/checksums.json"),
      anatomyCatalog: {
        atlasSha256: json("src/anatomyCatalog.json").atlasSha256,
        models: json("src/anatomyCatalog.json").models,
      },
      publicAssetChecksums: Object.fromEntries(
        assets.map((p) => [p.replace(/^public\//, ""), hash(read(p))]),
      ),
      notices: noticeRecords,
      publications: papers,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${check ? "Checked" : "Built"} credits: ${catalog.entries.length} source groups, ${papers.length} publications, ${noticeRecords.length} preserved notices.`,
);
