import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const source: { nativeId: string; family: string; side: string }[] = JSON.parse(
  readFileSync(
    new URL("../biomechanics/models/spine/muscles.json", import.meta.url),
    "utf8",
  ),
);
const deepBack = new Set([
  "Multifidus lumborum",
  "Multifidus thoracis",
  "Multifidus",
  "Longissimus thoracis",
  "Iliocostalis lumborum",
]);
const expectedBack = source
  .filter((m) => deepBack.has(m.family))
  .map((m) => "spine__" + m.nativeId)
  .sort();
async function open(page: Page) {
  await page.addInitScript(() => {
    (window as any).__THREE_DEVTOOLS__ = {
      dispatchEvent(event: CustomEvent) {
        const renderer = event.detail;
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene: any, camera: any) => {
          if (
            renderer.domElement.closest(".bio-interaction") &&
            !renderer.domElement.closest(".wholebody-lab")
          )
            (window as any).__spineView = { scene, camera };
          return render(scene, camera);
        };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
}
async function paths(page: Page) {
  return page.evaluate(() => {
    const result: string[] = [];
    (window as any).__spineView.scene.traverse((o: any) => {
      if (o.isLine2 && o.parent.visible) result.push(o.userData.muscle);
    });
    return result.sort();
  });
}

test("spine opens with both sides of the deep back, with explicit isolation and accurate layer counts", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("button", { name: "Regional context", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Isolate path", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => paths(page)).toEqual(expectedBack);
  await expect(page.locator(".wholebody-layer-summary")).toContainText(
    `${expectedBack.length} paths shown`,
  );
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("kinetic-movement-v1-reference-spine"),
  );
  await page.getByRole("button", { name: "Isolate path", exact: true }).click();
  await expect.poll(() => paths(page)).toEqual(["spine__MF_m1s_r"]);
  await expect(page.locator(".wholebody-layer-summary")).toContainText(
    "1 path shown",
  );
  await page
    .getByRole("button", { name: "Show muscle context", exact: true })
    .click();
  await expect.poll(() => paths(page)).toEqual(expectedBack);
  // Choosing a display mode must also exit explicit isolation.
  await page.getByRole("button", { name: "Isolate path", exact: true }).click();
  await page
    .getByRole("button", { name: "Selected muscle", exact: true })
    .click();
  await expect
    .poll(() => paths(page))
    .toEqual(
      source
        .filter((m) => m.family === "Multifidus lumborum" && m.side === "Right")
        .map((m) => "spine__" + m.nativeId)
        .sort(),
    );
  await expect(
    page.getByRole("button", { name: "Isolate path", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "All paths", exact: true }).click();
  await expect.poll(async () => (await paths(page)).length).toBe(552);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("kinetic-movement-v1-reference-spine"),
    ),
  ).toBe(saved);
});

test("spine context survives grouped motion; opacity, markers, side filters and bones-only remain consistent", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Spine control group").selectOption("lumbar");
  await page
    .getByRole("slider", {
      name: "Lumbar spine Flexion / extension",
      exact: true,
    })
    .fill("-10");
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
  await expect.poll(() => paths(page)).toEqual(expectedBack);
  await page
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Deep back", exact: true }),
  ).toBeChecked();
  await page.getByLabel("Muscle layer side").selectOption("Left");
  await expect
    .poll(() => paths(page))
    .toEqual(
      [
        ...source
          .filter((m) => deepBack.has(m.family) && m.side === "Left")
          .map((m) => "spine__" + m.nativeId),
        "spine__MF_m1s_r",
      ].sort(),
    );
  await page
    .getByRole("slider", { name: "Bone opacity", exact: true })
    .fill("50");
  await page.getByLabel("Show attachment markers").check();
  const display = await page.evaluate(() => {
    const widths: number[] = [],
      markers: number[] = [],
      bones: number[] = [];
    (window as any).__spineView.scene.traverse((o: any) => {
      if (o.isLine2) widths.push(o.material.linewidth);
      if (o.userData.endpoint) markers.push(o.material.size);
      if (o.userData.bone) bones.push(o.material.opacity);
    });
    return { widths, markers, bones };
  });
  expect(Math.max(...display.widths)).toBe(4);
  expect(display.markers).toEqual([7]);
  expect(Math.max(...display.bones)).toBe(0.5);
  await expect(
    page.getByRole("slider", {
      name: "Lumbar spine Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("-10");
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await expect.poll(() => paths(page)).toEqual([]);
  await expect(page.locator(".wholebody-layer-summary")).toContainText(
    "0 paths shown",
  );
  await page.getByRole("button", { name: "Neck", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "52 muscle compartments",
  );
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Bones only", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await paths(page)).length).toBeGreaterThan(1);
  await expect(page.locator(".wholebody-layer-summary")).not.toContainText(
    "0 paths shown",
  );
});

test("spine layers stay accessible on mobile and alongside whole-body layers", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  const regionalId = await page
    .getByRole("button", { name: "Layer settings", exact: true })
    .getAttribute("aria-controls");
  await page
    .locator(".bio-lab-options")
    .getByRole("button", { name: "Whole body", exact: true })
    .click();
  await expect(page.locator(".wholebody-lab .bio-status")).toContainText(
    "Shared pose ready",
  );
  await page
    .getByRole("button", { name: "Layer settings", exact: true })
    .click();
  expect(
    await page
      .getByRole("button", { name: "Layer settings", exact: true })
      .getAttribute("aria-controls"),
  ).not.toBe(regionalId);
  await page.getByRole("button", { name: "Regional", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("checkbox", { name: "Deep back", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
