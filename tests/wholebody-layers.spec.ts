import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const sourceMuscles: { nativeId: string; family: string; side: string }[] =
  JSON.parse(
    readFileSync(
      new URL("../biomechanics/models/spine/muscles.json", import.meta.url),
      "utf8",
    ),
  );

const selectedId = "wholebody__MF_m3t_2_r";
const rightMultifidus = sourceMuscles
  .filter((m) => m.family === "Multifidus lumborum" && m.side === "Right")
  .map((m) => "wholebody__" + m.nativeId)
  .sort();
async function open(page: Page) {
  await page.addInitScript(() => {
    (window as any).__THREE_DEVTOOLS__ = {
      dispatchEvent(event: CustomEvent) {
        const renderer = event.detail;
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene: any, camera: any) => {
          if (renderer.domElement.closest(".wholebody-lab"))
            (window as any).__layersView = { scene, camera };
          return render(scene, camera);
        };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page
    .locator(".bio-lab-options")
    .getByRole("button", { name: "Whole body", exact: true })
    .click();
  const lab = page.locator(".wholebody-lab");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  await lab
    .getByRole("searchbox", { name: "Search whole-body muscles" })
    .fill("Right Multifidus lumborum · MF_m3t_2");
  await lab.locator(".wholebody-muscle-list button").click();
  return lab;
}
async function scene(page: Page) {
  return page.evaluate(() => {
    const { scene, camera } = (window as any).__layersView;
    const paths: { id: string; width: number; worldUnits: boolean }[] = [];
    const markers: { size: number; attenuated: boolean; points: number[] }[] =
      [];
    const bones: number[] = [];
    scene.traverse((o: any) => {
      if (o.isLine2 && o.parent.visible)
        paths.push({
          id: o.userData.muscle,
          width: o.material.linewidth,
          worldUnits: o.material.worldUnits,
        });
      if (o.userData.endpoint && o.parent.visible)
        markers.push({
          size: o.material.size,
          attenuated: o.material.sizeAttenuation,
          points: Array.from(o.geometry.attributes.position.array),
        });
      if (o.userData.bone) bones.push(o.visible ? o.material.opacity : 0);
    });
    return {
      paths,
      markers,
      bones,
      camera: camera.position.toArray() as number[],
    };
  });
}

test("all native paths have explicit muscle-family, side and display-group coverage", async ({
  request,
  page,
}) => {
  const config = await (
    await request.get("/api/biomechanics/config?region=wholebody")
  ).json();
  await page.goto("/");
  const metadata = (await page.evaluate(async (muscles) => {
    const { wholeBodyMuscles } = await import("/src/wholeBodyDisplay.ts");
    return wholeBodyMuscles(muscles);
  }, config.muscles)) as {
    id: string;
    family: string;
    side: string;
    layer?: string;
  }[];
  expect(metadata).toHaveLength(598);
  expect(new Set(metadata.map((m) => m.id)).size).toBe(598);
  expect(metadata.filter((m) => !m.layer)).toEqual([]);
  const byId = new Map(metadata.map((m) => [m.id, m]));
  for (const source of sourceMuscles) {
    expect(byId.get("wholebody__" + source.nativeId)).toMatchObject({
      family: source.family,
      side: source.side,
    });
  }
  for (const muscle of config.muscles) {
    const m = byId.get(muscle.id)!;
    expect(muscle.name.startsWith(`${m.side} ${m.family}`)).toBe(true);
  }
  expect(
    metadata.filter((m) => m.family === "Biceps femoris" && m.side === "Right"),
  ).toHaveLength(2);
  expect(rightMultifidus).toHaveLength(25);
});

test("default muscle view, side filters and regional groups preserve the shared pose", async ({
  page,
}) => {
  const lab = await open(page);
  let requests = 0;
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/biomechanics/pose") &&
      r.postDataJSON()?.region === "wholebody"
    )
      requests++;
  });
  const startLength = await lab.locator(".wholebody-delta").textContent();
  await expect
    .poll(async () => (await scene(page)).paths.map((p) => p.id).sort())
    .toEqual(rightMultifidus);
  expect((await scene(page)).markers).toHaveLength(0);
  await expect(lab.locator(".wholebody-layer-summary")).toContainText(
    "25 paths shown",
  );
  await lab
    .getByRole("button", { name: "Muscle anatomy", exact: true })
    .click();
  await expect(lab.locator(".bio-atlas-comparison")).toContainText(
    "one of 25 modeled paths",
  );
  await expect(lab.locator(".wholebody-strand-note")).toContainText(
    "length below is for this strand",
  );
  await lab
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  await lab
    .getByRole("combobox", { name: "Muscle layer side" })
    .selectOption("both");
  await expect.poll(async () => (await scene(page)).paths.length).toBe(50);
  await lab
    .getByRole("combobox", { name: "Muscle layer side" })
    .selectOption("Left");
  await expect.poll(async () => (await scene(page)).paths.length).toBe(26);
  expect(
    (await scene(page)).paths
      .filter((p) => !p.id.endsWith("_l"))
      .map((p) => p.id),
  ).toEqual([selectedId]);
  await lab
    .getByRole("combobox", { name: "Muscle layer side" })
    .selectOption("selected");
  await lab
    .getByRole("button", { name: "Regional context", exact: true })
    .click();
  await expect(
    lab.getByRole("checkbox", { name: "Deep back", exact: true }),
  ).toBeChecked();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(82);
  await lab
    .getByRole("checkbox", { name: "Abdominal wall", exact: true })
    .check();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(120);
  await lab.getByRole("checkbox", { name: "Deep back", exact: true }).uncheck();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(63); // Selected family plus abdominal context.
  await lab.getByRole("button", { name: "All paths", exact: true }).click();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(598);
  await expect(
    lab.getByRole("combobox", { name: "Muscle layer side" }),
  ).toHaveValue("both");
  await lab
    .getByRole("button", { name: "Selected muscle", exact: true })
    .click();
  await expect
    .poll(async () => (await scene(page)).paths.map((p) => p.id).sort())
    .toEqual(rightMultifidus);
  await expect(lab.locator(".wholebody-delta")).toHaveText(startLength!);
  expect(requests).toBe(0);
  await lab
    .locator(".wholebody-group summary")
    .filter({ hasText: "Lumbar spine" })
    .click();
  await lab
    .locator(".wholebody-group")
    .filter({ hasText: "Lumbar spine" })
    .locator(".bio-spine-individual > summary")
    .click();
  await lab
    .getByRole("slider", {
      name: "Lumbar spine L3–L4 Flexion / extension",
      exact: true,
    })
    .fill("-3");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  expect(requests).toBe(1);
  await expect(lab.locator(".wholebody-delta")).not.toHaveText(startLength!);
  await expect
    .poll(async () => (await scene(page)).paths.map((p) => p.id).sort())
    .toEqual(rightMultifidus);
});

test("zoom keeps context lines and optional endpoint markers small; bone fading is independent", async ({
  page,
}) => {
  const lab = await open(page);
  await lab
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  await lab.getByRole("checkbox", { name: "Show attachment markers" }).check();
  await lab
    .getByRole("slider", { name: "Bone opacity", exact: true })
    .fill("40");
  await expect
    .poll(async () =>
      (await scene(page)).bones.every((opacity) => opacity === 0.4),
    )
    .toBe(true);
  await lab
    .getByRole("button", { name: "Focus selected path", exact: true })
    .click();
  const before = await scene(page);
  expect(before.markers).toHaveLength(1);
  expect(before.markers[0].attenuated).toBe(false);
  expect(before.markers[0].size).toBeLessThanOrEqual(8);
  expect(
    before.paths
      .filter((p) => p.id !== selectedId)
      .every((p) => !p.worldUnits && p.width <= 1.5),
  ).toBe(true);
  // The short multifidus path is already at the minimum camera distance.
  await lab.getByRole("button", { name: "Zoom out", exact: true }).click();
  const after = await scene(page);
  expect(after.camera).not.toEqual(before.camera);
  expect(after.markers).toEqual(before.markers);
  expect(after.paths).toEqual(before.paths);
  await lab.getByRole("button", { name: "Bones only", exact: true }).click();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(0);
  expect((await scene(page)).bones.every((opacity) => opacity === 1)).toBe(
    true,
  );
  await expect(lab.locator(".wholebody-layer-summary")).toContainText(
    "0 paths shown",
  );
  await expect(
    lab.getByRole("slider", { name: "Bone opacity", exact: true }),
  ).toBeDisabled();
  await lab.getByRole("button", { name: "Bones only", exact: true }).click();
  await expect
    .poll(async () =>
      (await scene(page)).bones.every((opacity) => opacity === 0.4),
    )
    .toBe(true);
  await lab
    .getByRole("checkbox", { name: "Show attachment markers" })
    .uncheck();
  await expect.poll(async () => (await scene(page)).markers.length).toBe(0);
  await lab
    .getByRole("slider", { name: "Bone opacity", exact: true })
    .fill("0");
  expect((await scene(page)).bones.every((opacity) => opacity === 0)).toBe(
    true,
  );
  await expect.poll(async () => (await scene(page)).paths.length).toBe(25);
});

test("layer controls fit mobile and remain keyboard and screen-reader accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const lab = await open(page);
  await lab
    .getByRole("button", { name: "Regional context", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    lab.getByRole("checkbox", { name: "Deep back", exact: true }),
  ).toBeVisible();
  await lab.getByRole("checkbox", { name: "Show attachment markers" }).focus();
  await page.keyboard.press("Space");
  await expect(
    lab.getByRole("checkbox", { name: "Show attachment markers" }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await lab
    .locator(".wholebody-layers")
    .screenshot({ path: ".playwright/wholebody-layers-mobile.png" });
});

test("hidden context paths cannot be hovered or selected", async ({
  page,
  request,
}) => {
  const lab = await open(page);
  const config = await (
    await request.get("/api/biomechanics/config?region=wholebody")
  ).json();
  const rectus = config.baseline.muscles.find(
    (m: any) => m.id === "wholebody__rect_abd_r",
  );
  await lab.getByRole("button", { name: "All paths", exact: true }).click();
  await lab
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  await lab
    .getByRole("slider", { name: "Bone opacity", exact: true })
    .fill("0");
  await lab.getByRole("button", { name: "Front", exact: true }).click();
  const canvas = lab.locator(".bio-canvas canvas");
  const project = (point: number[]) =>
    page.evaluate((p) => {
      const { scene, camera } = (window as any).__layersView;
      const root = scene.children.find((o: any) => o.isGroup);
      const v = camera.position
        .clone()
        .set(...p)
        .applyMatrix4(root.matrixWorld)
        .project(camera);
      const rect = document
        .querySelector(".wholebody-lab .bio-canvas canvas")!
        .getBoundingClientRect();
      return {
        x: rect.x + ((v.x + 1) * rect.width) / 2,
        y: rect.y + ((1 - v.y) * rect.height) / 2,
      };
    }, point);
  await canvas.scrollIntoViewIfNeeded();
  let target: number[] | undefined;
  for (let i = 1; i < rectus.path.length && !target; i++) {
    for (const t of [0.25, 0.5, 0.75]) {
      const point = rectus.path[i].map(
        (v: number, j: number) =>
          rectus.path[i - 1][j] + t * (v - rectus.path[i - 1][j]),
      );
      const p = await project(point);
      await page.mouse.move(p.x, p.y);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const tip = lab.getByRole("tooltip");
      if (
        (await tip.isVisible()) &&
        (await tip.textContent())?.includes("Rectus abdominis")
      ) {
        target = point;
        break;
      }
    }
  }
  expect(
    target,
    "Find a visible abdominal path before hiding its group",
  ).toBeTruthy();
  await lab
    .getByRole("button", { name: "Selected muscle", exact: true })
    .click();
  await expect
    .poll(async () => (await scene(page)).paths.map((p) => p.id).sort())
    .toEqual(rightMultifidus);
  await canvas.scrollIntoViewIfNeeded();
  const p = await project(target!);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const tip = lab.getByRole("tooltip");
  if (await tip.isVisible())
    await expect(tip).toContainText("Multifidus lumborum");
  await page.mouse.click(p.x, p.y);
  await expect(lab.locator(".wholebody-comparison h3")).toHaveText(
    "Right Multifidus lumborum",
  );
});

test("a withheld strand stays unavailable when layers are changed", async ({
  page,
}) => {
  const lab = await open(page);
  await page.route("**/api/biomechanics/pose", async (route) => {
    if (route.request().postDataJSON().region !== "wholebody")
      return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    const muscle = body.muscles.find((m: any) => m.id === selectedId);
    muscle.available = false;
    muscle.unavailableReason = "Path verification failed.";
    // Defensively reject even an unavailable sample that still carries points.
    await route.fulfill({ response, json: body });
  });
  await lab
    .getByRole("slider", { name: "Right hip Flexion / extension", exact: true })
    .fill("30");
  await expect(lab.locator(".wholebody-delta")).toHaveText(
    "Comparison unavailable",
  );
  await expect(
    lab.getByRole("button", { name: "Focus selected path", exact: true }),
  ).toBeDisabled();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(24);
  await lab.getByRole("button", { name: "All paths", exact: true }).click();
  await expect.poll(async () => (await scene(page)).paths.length).toBe(597);
  expect((await scene(page)).paths.some((p) => p.id === selectedId)).toBe(
    false,
  );
  await lab
    .getByRole("button", { name: "Selected muscle", exact: true })
    .click();
  await expect(lab.locator(".wholebody-layer-summary")).toContainText(
    "24 paths shown",
  );
});
