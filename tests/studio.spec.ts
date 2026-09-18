import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import catalog from "../src/anatomyCatalog.json" with { type: "json" };

async function openReference(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Anatomy reference", exact: true })
    .click();
  return page.getByRole("region", { name: "Anatomy reference", exact: true });
}

test("Movement Lab is home, with no standalone Explore, notes or quizzes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button"),
  ).toHaveText(["Movement lab"]);
  await expect(
    page.getByRole("heading", {
      name: "Explore the shoulder joint.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Explore$|my notes|learn in 3d|quiz/i }),
  ).toHaveCount(0);
});

test("the full catalog distinguishes anatomy-only shapes from linked paths and survives a failed viewer", async ({
  page,
}) => {
  await page.route("**/models/body.glb", (route) => route.abort());
  const reference = await openReference(page);
  await expect(reference.locator(".atlas-entry")).toHaveCount(
    catalog.entries.length,
  );
  await expect(reference.getByText(/The 3D model couldn’t load/)).toBeVisible();
  await reference.getByLabel("Search anatomy").fill("diaphragm");
  await reference.locator(".atlas-entry").click();
  await expect(reference.locator(".atlas-selected-heading")).toContainText(
    "Anatomy only",
  );
  await expect(reference.locator(".atlas-details")).toContainText(
    "length comparisons and longest-path search are unavailable",
  );
  await expect(reference.getByRole("button", { name: /Open in/ })).toHaveCount(
    0,
  );
  await reference.getByLabel("Search anatomy").fill("rhomboid");
  await reference.locator(".atlas-entry").first().click();
  await expect(reference.locator(".atlas-selected-heading")).toContainText(
    "Modeled",
  );
  await expect(
    reference.getByRole("button", { name: "Open in Shoulder", exact: true }),
  ).toBeVisible();
  expect(
    await reference
      .getByLabel("Linked movement path")
      .locator("optgroup")
      .allTextContents(),
  ).not.toContain("Whole body");
  await reference
    .getByLabel("Search anatomy")
    .fill("not an anatomical structure");
  await expect(reference.getByText("No structures match.")).toBeVisible();
  await reference.getByRole("button", { name: "Clear filters" }).click();
  await reference.getByLabel("Search anatomy").fill("Anterior scalene");
  await expect(reference.locator(".atlas-entry")).toHaveCount(1);
  await expect(reference.locator(".atlas-entry")).toContainText(
    "Scalenus Anterior",
  );
  await reference.getByLabel("Search anatomy").fill("");
  await reference.getByLabel("Filter anatomy coverage").selectOption("anatomy");
  await expect(reference.locator(".atlas-entry")).toHaveCount(
    catalog.entries.filter((e) => !e.paths.length).length,
  );
});

test("resting anatomy highlights deep and lower-body shapes with camera and side controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const reference = await openReference(page);
  const canvas = reference.locator("canvas");
  await expect(canvas).toHaveAttribute("data-highlighted-meshes", "1");
  for (const query of ["diaphragm", "soleus"]) {
    await reference.getByLabel("Search anatomy").fill(query);
    await reference.locator(".atlas-entry").first().click();
    await expect(canvas).toHaveAttribute("data-highlighted-meshes", /[1-9]/);
    await expect(canvas).toHaveAttribute(
      "data-selected",
      new RegExp(query, "i"),
    );
  }
  await reference.getByLabel("Anatomy side").selectOption("both");
  await expect(canvas).toHaveAttribute("data-highlighted-meshes", "2");
  await reference.getByRole("button", { name: "Back", exact: true }).click();
  await reference
    .getByRole("button", { name: "Zoom in anatomy", exact: true })
    .click();
  await reference
    .getByRole("button", { name: "Zoom out anatomy", exact: true })
    .click();
  await reference
    .getByRole("button", { name: "Reset anatomy view", exact: true })
    .click();
  await reference.getByLabel("Surrounding muscles").check();
  expect(errors).toEqual([]);
});

test("catalog links select the requested regional or whole-body path", async ({
  page,
}) => {
  const reference = await openReference(page);
  await reference
    .getByLabel("Search anatomy")
    .fill("long head of biceps brachii");
  await reference.locator(".atlas-entry").click();
  const paths = reference.getByLabel("Linked movement path");
  const armIndex = catalog.entries
    .find((e) => e.name === "Long Head Of Biceps Brachii")!
    .paths.findIndex((p) => p.region === "arm");
  await paths.selectOption(String(armIndex));
  await reference
    .getByRole("button", { name: "Open in Elbow & wrist", exact: true })
    .click();
  await expect(page.locator(".bio-selected h3")).toHaveText(
    /Biceps.*long head/i,
  );
  await expect(
    page.getByRole("button", { name: "Elbow", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Anatomy reference", exact: true })
    .click();
  await reference.getByLabel("Search anatomy").fill("soleus");
  await reference.locator(".atlas-entry").click();
  const wholeIndex = catalog.entries
    .find((e) => e.name === "Soleus Muscle")!
    .paths.findIndex(
      (p) => p.region === "wholebody" && p.name.startsWith("Left"),
    );
  await paths.selectOption(String(wholeIndex));
  await reference
    .getByRole("button", { name: "Open in Whole body", exact: true })
    .click();
  await expect(
    page.locator(".wholebody-lab .wholebody-comparison"),
  ).toContainText("Left Soleus");
});

test("browsing anatomy preserves the live pose and saved reference", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".bio-status")).toContainText(
    "33 muscle compartments",
  );
  const slider = page.getByRole("slider", {
    name: "Shoulder elevation (abduction / flexion)",
    exact: true,
  });
  await slider.fill("65");
  await expect(page.locator(".bio-status")).not.toContainText("Calculating");
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("kinetic-movement-v1-reference-shoulder"),
  );
  await page
    .getByRole("button", { name: "Anatomy reference", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to movement", exact: true })
    .click();
  await expect(slider).toHaveValue("65");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("kinetic-movement-v1-reference-shoulder"),
    ),
  ).toBe(saved);
});

test("mobile anatomy search and movement fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reference = await openReference(page);
  await reference.getByLabel("Search anatomy").fill("subclavius");
  await reference.locator(".atlas-entry").click();
  await expect(reference.locator(".atlas-selected-heading h3")).toHaveText(
    "Subclavius Muscle",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await reference.getByRole("button", { name: "Back to movement" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("catalog covers every source shape and links only to exposed native paths", async ({
  request,
}) => {
  const bytes = readFileSync("public/models/body.glb");
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  const sourceNames = [
    ...new Set(
      gltf.nodes
        .filter(
          (n: { extras?: { type: string } }) => n.extras?.type === "muscle",
        )
        .map((n: { extras: { nameDetail: string } }) =>
          n.extras.nameDetail.replaceAll("_", " "),
        ),
    ),
  ].sort();
  expect(catalog.entries.map((e) => e.name).sort()).toEqual(sourceNames);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    catalog.atlasSha256,
  );
  for (const model of catalog.models) {
    const response = await request.get(
      `/api/biomechanics/config?region=${model.region}`,
    );
    expect(response.ok()).toBe(true);
    const config = await response.json();
    expect(config.modelVersion).toBe(model.modelVersion);
    expect(config.muscles).toHaveLength(model.pathCount);
    const exposed = new Set(config.muscles.map((m: { id: string }) => m.id));
    for (const entry of catalog.entries)
      for (const path of entry.paths.filter((p) => p.region === model.region))
        expect(exposed.has(path.id), `${entry.name}: ${path.id}`).toBe(true);
  }
});
