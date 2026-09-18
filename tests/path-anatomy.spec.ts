import { test, expect, type Page } from "@playwright/test";
import * as THREE from "three";
import AxeBuilder from "@axe-core/playwright";
async function openHip(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Hip", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
}
test("a rendered path can be hovered and clicked to open its named atlas muscle", async ({
  page,
  request,
}) => {
  await openHip(page);
  await page
    .locator(".bio-viewer-bottom")
    .getByRole("button", { name: "Front", exact: true })
    .click();
  const c = await (
    await request.get("/api/biomechanics/config?region=hip")
  ).json();
  const canvas = page.locator(".bio-canvas canvas");
  const rect = (await canvas.boundingBox())!;
  const root = new THREE.Matrix4().makeRotationY(-Math.PI / 2),
    box = new THREE.Box3();
  for (const mesh of c.meshes) {
    const t = c.baseline.transforms[mesh.frame],
      mat = new THREE.Matrix4().set(
        ...([...t[0], ...t[1], ...t[2], 0, 0, 0, 1] as Parameters<
          THREE.Matrix4["set"]
        >),
      );
    for (const v of mesh.vertices)
      box.expandByPoint(
        new THREE.Vector3(...(v as [number, number, number]))
          .applyMatrix4(mat)
          .applyMatrix4(root),
      );
  }
  const center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3()),
    camera = new THREE.PerspectiveCamera(
      36,
      rect.width / rect.height,
      0.005,
      50,
    );
  camera.position
    .copy(center)
    .add(
      new THREE.Vector3(
        0,
        0.04,
        Math.max(size.y, size.x / camera.aspect) * 1.85,
      ),
    );
  camera.lookAt(center);
  camera.updateMatrixWorld();
  let picked = "";
  outer: for (const muscle of c.baseline.muscles.filter(
    (m: any) => m.id !== "bflh_r" && m.id !== "tfl_r",
  )) {
    const name = c.muscles.find((m: any) => m.id === muscle.id).name;
    for (
      let i = 1;
      i < muscle.path.length;
      i += Math.max(1, Math.floor(muscle.path.length / 6))
    ) {
      const p = new THREE.Vector3(
        ...(muscle.path[i] as [number, number, number]),
      )
        .lerp(
          new THREE.Vector3(
            ...(muscle.path[i - 1] as [number, number, number]),
          ),
          0.5,
        )
        .applyMatrix4(root)
        .project(camera);
      const x = rect.x + ((p.x + 1) * rect.width) / 2,
        y = rect.y + ((1 - p.y) * rect.height) / 2;
      if (
        x < rect.x ||
        x > rect.x + rect.width ||
        y < rect.y + 100 ||
        y > rect.y + rect.height - 180
      )
        continue;
      await page.mouse.move(x, y);
      const tip = page.getByRole("tooltip");
      if (
        (await tip.isVisible()) &&
        (await tip.textContent())?.startsWith(name)
      ) {
        picked = name;
        await page.mouse.click(x, y);
        break outer;
      }
    }
  }
  expect(picked).not.toBe("");
  await expect(page.locator(".bio-picked-path")).toContainText(picked);
  await expect(
    page.getByRole("region", { name: "Selected muscle anatomy" }),
  ).toContainText(picked);
  await expect(page.locator(".bio-anatomy-canvas canvas")).toBeVisible();
  await page.screenshot({
    path: ".playwright/clicked-muscle-anatomy.png",
    fullPage: true,
  });
});
test("list selection maps actual muscle shapes, distinguishes compartments and does not deform the atlas", async ({
  page,
}) => {
  await openHip(page);
  await page
    .getByRole("button", { name: "Show muscle anatomy", exact: true })
    .click();
  await expect(page.locator(".bio-anatomy-heading h3")).toHaveText(
    "Biceps femoris · long head",
  );
  await expect(page.locator(".bio-anatomy-canvas canvas")).toBeVisible();
  const atlasPixels = () =>
    page
      .locator(".bio-anatomy-canvas canvas")
      .evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const first = await atlasPixels();
  await page
    .getByRole("slider", { name: "X Hip flexion / extension", exact: true })
    .fill("70");
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  expect(await atlasPixels()).toBe(first);
  await page.getByLabel("Find a muscle path").fill("Gluteus maximus");
  await page.locator(".bio-muscle-list button").first().click();
  await expect(page.locator(".bio-anatomy-heading h3")).toHaveText(
    "Gluteus maximus",
  );
  await expect(page.locator(".bio-anatomy-reference")).toContainText(
    "not separately segmented",
  );
  await page.getByLabel("Find a muscle path").fill("Tensor fasciae");
  await page.locator(".bio-muscle-list button").click();
  await expect(page.locator(".bio-anatomy-reference")).toContainText(
    "iliotibial tract (IT band)",
  );
  await expect(page.locator(".bio-anatomy-canvas canvas")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "TFL muscle", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "IT band · fascia", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".bio-anatomy-reference")).toContainText(
    "does not separate muscle stretch from fascia stretch",
  );
  await page.getByLabel("Find a muscle path").fill("Rectus femoris");
  await page.locator(".bio-muscle-list button").click();
  await expect(page.locator(".bio-anatomy-heading h3")).toHaveText(
    "Rectus femoris",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("TFL and fascia can be inspected independently beside the unchanged joint pose", async ({
  page,
}) => {
  await openHip(page);
  await page
    .getByRole("slider", { name: "X Hip flexion / extension", exact: true })
    .fill("50");
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  await page.getByLabel("Find a muscle path").fill("Tensor fasciae");
  await page.locator(".bio-muscle-list button").click();
  const canvas = page.locator(".bio-anatomy-canvas canvas");
  await expect(canvas).toBeVisible();
  // Wait until the reference has actually drawn, then compare pixels, not CSS clipping.
  const pixels = () =>
    canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await expect.poll(async () => (await pixels()).length).toBeGreaterThan(10000);
  const both = await pixels();
  const fascia = page.getByRole("checkbox", {
    name: "IT band · fascia",
    exact: true,
  });
  const muscle = page.getByRole("checkbox", {
    name: "TFL muscle",
    exact: true,
  });
  await fascia.uncheck();
  await expect.poll(pixels).not.toBe(both);
  const muscleOnly = await pixels();
  await muscle.uncheck();
  await expect.poll(pixels).not.toBe(muscleOnly);
  await muscle.check();
  await fascia.check();
  await expect.poll(pixels).toBe(both);
  const lengthBefore = await page.locator(".bio-delta").textContent();
  await page.getByRole("button", { name: "Knee", exact: true }).click();
  await expect(
    page.getByRole("slider", {
      name: "X Hip flexion / extension",
      exact: true,
    }),
  ).toHaveValue("50");
  await expect(page.locator(".bio-delta")).toHaveText(lengthBefore!);
  await page
    .getByRole("slider", { name: "K Knee flexion", exact: true })
    .fill("90");
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  expect(await pixels()).toBe(both);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("failed anatomy asset does not block native controls", async ({
  page,
}) => {
  await page.route("**/models/muscle-reference/atlas.json", (r) =>
    r.fulfill({ status: 503 }),
  );
  await openHip(page);
  await page
    .getByRole("button", { name: "Show muscle anatomy", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not load");
  await page
    .getByRole("slider", { name: "K Knee flexion", exact: true })
    .fill("90");
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  await expect(page.locator(".bio-delta")).toBeVisible();
});
