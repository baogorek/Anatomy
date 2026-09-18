import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page
    .getByRole("button", { name: "Deltoid close-up", exact: true })
    .click();
  await expect(
    page.getByRole("slider", {
      name: "Deltoid shoulder elevation",
      exact: true,
    }),
  ).toBeVisible();
}
test("unchanged anatomy and moving native mechanics stay connected", async ({
  page,
  request,
}) => {
  await open(page);
  const source = await (await request.get("/models/deltoid/demo.json")).json();
  const atlasCanvas = page
    .getByRole("group", { name: "Resting anatomy", exact: true })
    .locator("canvas");
  const staticBefore = await atlasCanvas.screenshot();
  const first = await page
    .getByRole("group", { name: "Moving mechanics", exact: true })
    .locator("canvas")
    .screenshot();
  await page
    .getByRole("slider", { name: "Deltoid shoulder elevation", exact: true })
    .fill(String(source.frames.length - 1));
  await expect(page.locator(".deltoid-motion-controls output")).toHaveText(
    "70°",
  );
  const id = "DeltoideusScapula_M",
    pick = (f: any) => f.pose.muscles.find((m: any) => m.id === id).length;
  const delta = pick(source.frames.at(-1)) - pick(source.frames[0]);
  await expect(page.locator(".deltoid-length strong")).toContainText(
    `${Math.abs(delta * 1000).toFixed(1)} mm`,
  );
  expect(
    (
      await page
        .getByRole("group", { name: "Moving mechanics", exact: true })
        .locator("canvas")
        .screenshot()
    ).equals(first),
  ).toBe(false);
  expect((await atlasCanvas.screenshot()).equals(staticBefore)).toBe(true);
  await page.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(page.locator(".deltoid-attachment").first()).toContainText(
    "clavicle",
  );
  await page.getByRole("button", { name: "Posterior", exact: true }).click();
  await expect(page.locator(".deltoid-attachment").first()).toContainText(
    "Spine of the scapula",
  );
  await page.getByLabel("Show calculated path", { exact: true }).check();
  await page
    .getByRole("button", { name: "Resting atlas", exact: true })
    .click();
  await expect(
    page.getByRole("slider", {
      name: "Deltoid shoulder elevation",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".deltoid-stage-heading")).toContainText(
    "RESTING ATLAS",
  );
  await page
    .getByRole("button", { name: "Compare anatomy & motion", exact: true })
    .click();
  await expect(page.locator(".deltoid-motion-controls output")).toHaveText(
    "70°",
  );
});
test("deltoid playback pauses and joint explorer stays available", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Play deltoid movement", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByRole("slider", {
          name: "Deltoid shoulder elevation",
          exact: true,
        })
        .inputValue(),
    )
    .not.toBe("0");
  await page
    .getByRole("button", { name: "Pause deltoid movement", exact: true })
    .click();
  const value = await page
    .getByRole("slider", { name: "Deltoid shoulder elevation", exact: true })
    .inputValue();
  await page.waitForTimeout(250);
  await expect(
    page.getByRole("slider", {
      name: "Deltoid shoulder elevation",
      exact: true,
    }),
  ).toHaveValue(value);
  await page
    .getByRole("button", { name: "Joint explorer", exact: true })
    .click();
  await expect(page.locator(".bio-status")).toContainText(
    "33 muscle compartments",
  );
  await page.getByRole("button", { name: "Hip", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "40 muscle compartments",
  );
  await expect(
    page.getByRole("slider", { name: "K Knee flexion", exact: true }),
  ).toBeVisible();
});
test("deltoid keyboard, fullscreen, mobile and accessibility", async ({
  page,
}) => {
  await open(page);
  const slider = page.getByRole("slider", {
    name: "Deltoid shoulder elevation",
    exact: true,
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  await page
    .getByRole("button", { name: "Expand deltoid demonstration", exact: true })
    .last()
    .click();
  await expect(slider).toBeVisible();
  await page
    .getByRole("button", { name: "Expand deltoid demonstration", exact: true })
    .last()
    .click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.screenshot({
    path: ".playwright/deltoid/mobile.png",
    fullPage: true,
  });
});
test("study asset failure leaves access to existing tools", async ({
  page,
}) => {
  await page.route("**/models/deltoid/demo.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page
    .getByRole("button", { name: "Deltoid close-up", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not load");
  await page
    .getByRole("button", { name: "Joint explorer", exact: true })
    .click();
  await expect(page.locator(".bio-status")).toContainText(
    "33 muscle compartments",
  );
});
