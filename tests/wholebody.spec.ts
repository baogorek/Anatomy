import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page
    .locator(".bio-lab-options")
    .getByRole("button", { name: "Whole body", exact: true })
    .click();
  const lab = page.getByRole("region", {
    name: "Whole-body movement lab",
    exact: true,
  });
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  return lab;
}
test("combined joints share a pose and reference, with independent regional state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let lab = await open(page);
  await expect(lab.locator('input[id^="wholebody-"]')).toHaveCount(72);
  await expect(lab.locator(".wholebody-group")).toHaveCount(13);
  const hip = lab.getByRole("slider", {
    name: "Right hip Flexion / extension",
    exact: true,
  });
  const knee = lab.getByRole("slider", {
    name: "Right knee Flexion",
    exact: true,
  });
  const ankle = lab.getByRole("slider", {
    name: "Right ankle Dorsiflexion / plantarflexion",
    exact: true,
  });
  await hip.fill("70");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  const hipDelta = await lab.locator(".wholebody-delta").textContent();
  expect(hipDelta).toContain("Longer");
  await ankle.fill("20");
  await expect(lab.locator(".wholebody-delta")).toHaveText(hipDelta!);
  await lab
    .getByRole("button", { name: "Save pose as reference", exact: true })
    .click();
  await expect(lab.locator(".wholebody-delta")).toContainText("+0.0 mm");
  await knee.fill("60");
  await expect(lab.locator(".wholebody-delta")).toContainText("Shorter");
  await expect(hip).toHaveValue("70");
  await expect(ankle).toHaveValue("20");
  await lab
    .getByRole("button", { name: "Reset right knee", exact: true })
    .click();
  await expect(knee).toHaveValue("0");
  await expect(lab.locator(".wholebody-delta")).toContainText("+0.0 mm");
  await page.getByRole("button", { name: "Regional", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Shoulder", exact: true }),
  ).toBeVisible();
  await page
    .locator(".bio-lab-options")
    .getByRole("button", { name: "Whole body", exact: true })
    .click();
  await expect(hip).toHaveValue("70");
  await page.reload();
  lab = await open(page);
  await expect(lab.locator(".wholebody-reference-label")).toContainText(
    "your saved pose",
  );
  await lab
    .getByRole("button", { name: "Return to reference pose", exact: true })
    .click();
  await expect(lab.locator(".wholebody-delta")).toContainText("+0.0 mm");
  await expect(
    lab.getByRole("slider", {
      name: "Right hip Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("70");
  await lab
    .getByRole("button", { name: "Reset whole pose", exact: true })
    .click();
  await expect(lab.locator(".wholebody-delta")).toContainText("Shorter");
  await lab
    .getByRole("button", { name: "Use starting reference", exact: true })
    .click();
  await expect(lab.locator(".wholebody-delta")).toContainText("+0.0 mm");
  expect(errors).toEqual([]);
});

test("whole-body camera, bilateral bones, muscle search and coverage are accessible", async ({
  page,
}) => {
  const lab = await open(page);
  await lab
    .getByRole("searchbox", { name: "Search whole-body muscles" })
    .fill("gastrocnemius");
  await expect(lab.locator(".wholebody-muscle-list button")).toHaveCount(2);
  await lab
    .locator(".wholebody-muscle-list button")
    .filter({ hasText: "Right Gastrocnemius" })
    .click();
  await lab
    .getByRole("slider", {
      name: "Right ankle Dorsiflexion / plantarflexion",
      exact: true,
    })
    .fill("20");
  await expect(lab.locator(".wholebody-delta")).toContainText("Longer");
  await lab
    .getByRole("button", { name: "Muscle anatomy", exact: true })
    .click();
  await expect(lab.locator(".wholebody-anatomy")).toContainText(
    "matched resting muscle surface is not available",
  );
  await lab
    .getByRole("button", { name: "Close muscle anatomy", exact: true })
    .click();
  await lab
    .getByRole("combobox", { name: "Whole-body camera focus" })
    .selectOption("ankle_l");
  const before = await lab.locator(".bio-canvas canvas").screenshot();
  await lab.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await lab.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  await lab.getByRole("button", { name: "Whole body", exact: true }).click();
  await lab.getByRole("button", { name: "Bones only", exact: true }).click();
  const options = await lab
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
  expect(new Set(options).size).toBe(options.length);
  await lab
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption(options.find((x) => x.includes("/calcn_l/"))!);
  await expect(lab.locator(".wholebody-coverage")).toContainText(
    "no elbow or forearm muscle paths",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await lab
    .getByRole("slider", { name: "Right hip Flexion / extension", exact: true })
    .fill("50");
  await expect(lab.locator(".wholebody-control-result")).toContainText(
    "Longer",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".playwright/wholebody-mobile.png",
    fullPage: true,
  });
});

test("failed and outdated responses cannot become a whole-body comparison", async ({
  page,
}) => {
  const lab = await open(page);
  await page.route("**/api/biomechanics/pose", async (route) => {
    if (route.request().postDataJSON().region !== "wholebody")
      return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.version = "outdated";
    await route.fulfill({ response, json: body });
  });
  await lab
    .getByRole("slider", { name: "Right hip Flexion / extension", exact: true })
    .fill("50");
  await expect(lab.getByRole("alert")).toContainText("model changed");
  await expect(lab.locator(".wholebody-delta")).toHaveText(
    "Comparison unavailable",
  );
  await expect(
    lab.getByRole("button", { name: "Save pose as reference", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/biomechanics/pose");
  await lab
    .getByRole("button", { name: "Reset whole pose", exact: true })
    .click();
  await expect(lab.locator(".wholebody-delta")).toContainText("+0.0 mm");
});

test("whole-body API rejects locked or unsupported controls", async ({
  request,
}) => {
  for (const coordinates of [
    { pro_sup_r: 10 },
    { knee_angle_l: -10 },
    { hip_flexion_r: true },
    { L1_L2_FE: 10 },
  ]) {
    expect(
      (
        await request.post("/api/biomechanics/pose", {
          data: { region: "wholebody", coordinates },
        })
      ).status(),
    ).toBe(400);
  }
});

test("mobile controls keep the muscle change visible and support keyboard movement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const lab = await open(page);
  const ankle = lab.getByRole("slider", {
    name: "Right ankle Dorsiflexion / plantarflexion",
    exact: true,
  });
  await ankle.fill("10");
  await ankle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(ankle).toHaveValue("11");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  await expect(lab.locator(".wholebody-control-result")).toBeInViewport();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("whole-body zoom and selected-path focus keep the native route and pose intact", async ({
  page,
  request,
}) => {
  // Inspect actual rendered camera/geometry through Three's existing devtools hook.
  // This avoids mistaking a tooltip or changed canvas size for a successful zoom.
  await page.addInitScript(() => {
    (window as any).__THREE_DEVTOOLS__ = {
      dispatchEvent(event: CustomEvent) {
        const renderer = event.detail;
        if (!renderer?.isWebGLRenderer) return;
        const render = renderer.render.bind(renderer);
        renderer.render = (scene: any, camera: any) => {
          if (renderer.domElement.closest(".wholebody-lab"))
            (window as any).__movementView = { scene, camera };
          return render(scene, camera);
        };
      },
    };
  });
  const lab = await open(page);
  await lab
    .getByRole("searchbox", { name: "Search whole-body muscles" })
    .fill("Left Gracilis");
  await lab.locator(".wholebody-muscle-list button").click();
  await lab
    .locator(".wholebody-group summary")
    .filter({ hasText: "Left hip" })
    .click();
  await lab
    .getByRole("slider", {
      name: "Left hip Adduction / abduction",
      exact: true,
    })
    .fill("-22");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  const length = await lab.locator(".wholebody-delta").textContent();
  await lab.getByRole("button", { name: "Front", exact: true }).click();
  const camera = () =>
    page.evaluate(() => {
      const { camera } = (window as any).__movementView;
      return {
        position: camera.position.toArray() as number[],
        direction: camera
          .getWorldDirection(camera.position.clone())
          .toArray() as number[],
      };
    });
  const travel = (
    a: Awaited<ReturnType<typeof camera>>,
    b: Awaited<ReturnType<typeof camera>>,
  ) =>
    b.position.reduce(
      (sum, x, i) => sum + (x - a.position[i]) * a.direction[i],
      0,
    );
  const canvas = lab.locator(".bio-canvas canvas");
  await canvas.scrollIntoViewIfNeeded();
  const before = await camera();
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -600);
  await expect
    .poll(async () => travel(before, await camera()))
    .toBeGreaterThan(0.2);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  const wheel = await camera();
  await lab.getByRole("button", { name: "Zoom in", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => travel(wheel, await camera()))
    .toBeGreaterThan(0.1);
  await lab.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect
    .poll(async () => Math.abs(travel(wheel, await camera())))
    .toBeLessThan(0.00001);
  await lab
    .getByRole("button", { name: "Focus selected path", exact: true })
    .click();
  const route = () =>
    page.evaluate(() => {
      const { scene, camera } = (window as any).__movementView;
      let path: any;
      scene.traverse((o: any) => {
        if (o.isLine2 && o.userData.muscle === "wholebody__grac_l") path = o;
      });
      const start = path.geometry.attributes.instanceStart;
      const end = path.geometry.attributes.instanceEnd;
      const points = Array.from({ length: start.count }, (_, i) => [
        start.getX(i),
        start.getY(i),
        start.getZ(i),
      ]);
      points.push([
        end.getX(end.count - 1),
        end.getY(end.count - 1),
        end.getZ(end.count - 1),
      ]);
      const world = points.map((p) =>
        camera.position
          .clone()
          .set(...p)
          .applyMatrix4(path.matrixWorld),
      );
      const center = world
        .reduce((sum, p) => sum.add(p), camera.position.clone().set(0, 0, 0))
        .divideScalar(world.length);
      return {
        points,
        projected: world.map((p) => p.clone().project(camera).toArray()),
        distance: camera.position.distanceTo(center) as number,
        depthTest: path.material.depthTest,
      };
    });
  const focused = await route();
  const native = await (
    await request.post("/api/biomechanics/pose", {
      data: { region: "wholebody", coordinates: { hip_adduction_l: -22 } },
    })
  ).json();
  const expected = native.muscles.find(
    (m: any) => m.id === "wholebody__grac_l",
  ).path;
  expect(focused.points).toHaveLength(expected.length);
  focused.points.forEach((point, i) =>
    point.forEach((x, j) => expect(x).toBeCloseTo(expected[i][j], 6)),
  );
  for (const p of focused.projected) {
    expect(Math.abs(p[0])).toBeLessThan(0.85);
    expect(Math.abs(p[1])).toBeLessThan(0.85);
  }
  expect(focused.depthTest).toBe(true); // Selection must not reveal paths through bones.
  await lab.getByRole("button", { name: "Back", exact: true }).click();
  expect((await route()).distance).toBeCloseTo(focused.distance, 1);
  await lab.getByRole("button", { name: "Whole body", exact: true }).click();
  expect((await route()).distance).toBeGreaterThan(focused.distance * 1.5);
  await expect(lab.locator(".wholebody-delta")).toHaveText(length!);
  await expect(
    lab.getByRole("slider", {
      name: "Left hip Adduction / abduction",
      exact: true,
    }),
  ).toHaveValue("-22");
});
