import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openLab(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "33 muscle compartments",
  );
}
async function ready(page: import("@playwright/test").Page) {
  const entry = page.getByRole("button", {
    name: "Joint explorer",
    exact: true,
  });
  if (await entry.isVisible()) await entry.click();
  await expect(page.locator(".bio-status")).toContainText(
    "muscle compartments",
  );
}

test("failed geometry remains withheld even with the corrected engine", async ({
  page,
}) => {
  await page.route("**/api/biomechanics/pose", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const muscle = body.muscles.find(
      (m: { id: string }) => m.id === "DeltoideusScapula_M",
    );
    muscle.available = false;
    muscle.path = [];
    muscle.pathErrorMm = 2;
    await route.fulfill({ response, json: body });
  });
  await openLab(page);
  await page
    .getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    })
    .fill("70");
  await ready(page);
  await expect(page.locator(".bio-selected")).toContainText(
    "did not pass the geometry check",
  );
  await expect(page.locator(".bio-delta")).toHaveCount(0);
});

test("a response from another calculation build cannot be compared with the current reference", async ({
  page,
}) => {
  await openLab(page);
  await page.route("**/api/biomechanics/pose", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.version = "0".repeat(64);
    await route.fulfill({ response, json: body });
  });
  await page
    .getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    })
    .fill("70");
  await expect(page.locator(".bio-error")).toContainText(
    "movement calculation changed",
  );
  await expect(page.locator(".bio-delta")).toHaveCount(0);
});

test("native shoulder sliders, reference comparisons, recorded motion and corrected wrapped paths", async ({
  page,
  request,
}) => {
  await openLab(page);
  const start = await page.locator(".bio-canvas canvas").screenshot();
  await page
    .getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    })
    .fill("70");
  await ready(page);
  const native = await (
    await request.post("/api/biomechanics/pose", {
      data: { region: "shoulder", coordinates: { shoulder_elv: 70 } },
    })
  ).json();
  const config = await (
    await request.get("/api/biomechanics/config?region=shoulder")
  ).json();
  const id = "DeltoideusScapula_M";
  const length = native.muscles.find((m: { id: string }) => m.id === id).length;
  const baseline = config.baseline.muscles.find(
    (m: { id: string }) => m.id === id,
  ).length;
  await expect(page.locator(".bio-delta")).toContainText(
    `${Math.abs((length - baseline) * 1000).toFixed(1)} mm`,
  );
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(start),
  ).toBe(false);
  await page.getByRole("button", { name: "Save current as reference" }).click();
  await expect(page.locator(".bio-delta")).toContainText("+0.0 mm");
  await page.getByRole("button", { name: "Start pose", exact: true }).click();
  await ready(page);
  await expect(page.locator(".bio-delta")).toContainText("Longer");
  await page.reload();
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await ready(page);
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  await page.getByRole("button", { name: "Use starting pose" }).click();
  await page.getByLabel("Find a muscle path").fill("Infraspinatus");
  await page.locator(".bio-muscle-list button").first().click();
  await expect(page.locator(".bio-delta")).toBeVisible();
  await page.getByLabel("Movement source").selectOption("ABD01");
  await ready(page);
  await expect(
    page.getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("slider", { name: "Movement progress", exact: true })
    .fill("45");
  await ready(page);
  await page
    .getByRole("button", { name: "Play movement", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByRole("slider", { name: "Movement progress", exact: true })
        .inputValue(),
    )
    .not.toBe("45");
  await page
    .getByRole("button", { name: "Pause movement", exact: true })
    .click();
  const value = await page
    .getByRole("slider", { name: "Movement progress", exact: true })
    .inputValue();
  await page.waitForTimeout(300);
  expect(
    await page
      .getByRole("slider", { name: "Movement progress", exact: true })
      .inputValue(),
  ).toBe(value);
});

test("hip and knee combinations update actual native lengths and keep coordinates independent", async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole("button", { name: "Hip", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  await page
    .getByRole("slider", { name: "X Hip flexion / extension", exact: true })
    .fill("70");
  await ready(page);
  await expect(page.locator(".bio-delta")).toContainText("+71.2 mm");
  await page
    .getByRole("slider", { name: "K Knee flexion", exact: true })
    .fill("90");
  await ready(page);
  await expect(
    page.getByRole("slider", {
      name: "X Hip flexion / extension",
      exact: true,
    }),
  ).toHaveValue("70");
  await expect(page.locator(".bio-delta")).not.toContainText("+71.2 mm");
  await page.getByRole("button", { name: "Isolate path", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Isolate path", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.screenshot({
    path: ".playwright/opensim-hip-tested.png",
    fullPage: true,
  });
});

test("stale native responses and backend failures never display stale length classifications", async ({
  page,
}) => {
  await openLab(page);
  await page.route("**/api/biomechanics/pose", async (route) => {
    const data = route.request().postDataJSON();
    if (data.coordinates?.shoulder_elv === 30)
      await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  const slider = page.getByRole("slider", {
    name: "Shoulder elevation (abduction / flexion)",
    exact: true,
  });
  await slider.fill("30");
  await page.waitForTimeout(70);
  await slider.fill("60");
  await ready(page);
  await page.waitForTimeout(550);
  await expect(slider).toHaveValue("60");
  await page.getByText("Model assumptions, coordinates & evidence").click();
  await expect(
    page
      .locator(".bio-coordinate-table>div")
      .filter({ has: page.locator("dt", { hasText: /^shoulder_elv$/ }) }),
  ).toContainText("60.000");
  await page.unroute("**/api/biomechanics/pose");
  await page.route("**/api/biomechanics/pose", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test: no result available" }),
    }),
  );
  await slider.fill("80");
  await expect(page.getByRole("alert")).toContainText("no result available");
  await expect(page.locator(".bio-delta")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save current as reference" }),
  ).toBeDisabled();
  await page.unroute("**/api/biomechanics/pose");
  await page.getByRole("button", { name: "Retry / reset" }).click();
  await ready(page);
  await expect(page.locator(".bio-delta")).toContainText("+0.0 mm");
});

test("movement workspace keyboard access, mobile layout, fullscreen and WCAG checks", async ({
  page,
}) => {
  await openLab(page);
  const slider = page.getByRole("slider", {
    name: "Shoulder elevation (abduction / flexion)",
    exact: true,
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await ready(page);
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Expand movement model", exact: true })
    .click();
  await expect(page.locator(".bio-interaction")).toHaveJSProperty(
    "clientHeight",
    1100,
  );
  await expect(slider).toBeVisible();
  await page
    .getByRole("button", { name: "Exit movement fullscreen", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(slider).toBeAttached();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
  await slider.fill("60");
  await ready(page);
  await page.screenshot({
    path: ".playwright/opensim-mobile.png",
    fullPage: true,
  });
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("atlas motion entry preserves stored data after notes removal", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "kinetic-anatomy-v1",
      JSON.stringify({
        saved: ["deltoid"],
        notes: { deltoid: "Keep my observation" },
      }),
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Anatomy reference", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to movement", exact: true })
    .click();
  await ready(page);
  await page
    .getByRole("button", { name: "Anatomy reference", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kinetic-anatomy-v1")!),
    ),
  ).toEqual({
    saved: ["deltoid"],
    notes: { deltoid: "Keep my observation" },
  });
});
