import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  combinedAngle,
  controlsForSpine,
  controlsForAxis,
  distributeSpineAngle,
  resetSpineGroup,
} from "../src/spineControls";
import type { ModelConfig, ModelPose } from "../src/biomechanics";

const controls: ModelConfig["controls"] = ["L1_L2", "L2_L3", "L3_L4"].map(
  (level) => ({
    id: `${level}_FE`,
    level,
    axis: "",
    label: "Flexion / extension",
    detail: "",
    min: -3,
    max: 3,
    default: 0,
  }),
);

test("group distribution preserves custom differences, respects joint limits and leaves other angles alone", () => {
  const start = {
    L1_L2_FE: 2.5,
    L2_L3_FE: -1,
    L3_L4_FE: 0.5,
    L3_L4_AR: 0.8,
    hip_flexion_r: 45,
  };
  const first = distributeSpineAngle(controls, start, 3.5);
  expect(first).toEqual({ ...start, L1_L2_FE: 3, L2_L3_FE: -0.5, L3_L4_FE: 1 });
  const limited = distributeSpineAngle(controls, start, 6);
  expect(limited).toEqual({
    ...start,
    L1_L2_FE: 3,
    L2_L3_FE: 0.75,
    L3_L4_FE: 2.25,
  });
  for (let target = -12; target <= 12; target += 0.2) {
    const next = distributeSpineAngle(controls, start, target);
    expect(combinedAngle(controls, next)).toBeCloseTo(
      Math.max(-9, Math.min(9, target)),
      6,
    );
    for (const c of controls) {
      expect(next[c.id]).toBeGreaterThanOrEqual(c.min);
      expect(next[c.id]).toBeLessThanOrEqual(c.max);
    }
    expect(next.L3_L4_AR).toBe(0.8);
    expect(next.hip_flexion_r).toBe(45);
  }
  expect(resetSpineGroup(controls, first)).toEqual({
    L3_L4_AR: 0.8,
    hip_flexion_r: 45,
  });
  expect(start.L1_L2_FE).toBe(2.5);
});

test("group totals are relative to defaults and round trips preserve adjustments away from limits", () => {
  const offset = controls.map((c) => ({ ...c, min: -4, max: 4, default: 1 }));
  const start = { L1_L2_FE: 0.5, L2_L3_FE: 1, L3_L4_FE: 1.5 };
  expect(combinedAngle(offset, start)).toBe(0);
  const next = distributeSpineAngle(offset, start, 1.5);
  expect(next).toEqual({ L1_L2_FE: 1, L2_L3_FE: 1.5, L3_L4_FE: 2 });
  expect(distributeSpineAngle(offset, next, 0)).toEqual(start);
});

async function ready(page: Page, region: "spine" | "wholebody") {
  await expect(
    page.getByRole("button", {
      name:
        region === "spine"
          ? "Save current as reference"
          : "Save pose as reference",
      exact: true,
    }),
  ).toBeEnabled();
}
async function changePose(
  page: Page,
  action: () => Promise<void>,
  region: "spine" | "wholebody",
): Promise<ModelPose> {
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/biomechanics/pose") &&
      r.request().postDataJSON()?.region === region &&
      r.ok(),
  );
  await action();
  const pose = await (await response).json();
  await ready(page, region);
  return pose;
}
async function openSpine(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await ready(page, "spine");
}

test("regional group sliders drive native joints, preserve other groups and saved references, and allow fine tuning", async ({
  page,
  request,
}) => {
  await openSpine(page);
  const config: ModelConfig = await (
    await request.get("/api/biomechanics/config?region=spine")
  ).json();
  await expect(
    page
      .getByRole("region", { name: "Entire spine grouped controls" })
      .getByRole("slider"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("combobox", { name: "Spinal joint", exact: true }),
  ).toBeHidden();
  await page.getByLabel("Spine control group").selectOption("lumbar");
  let pose = await changePose(
    page,
    () =>
      page
        .getByRole("slider", {
          name: "Lumbar spine Flexion / extension",
          exact: true,
        })
        .fill("-10"),
    "spine",
  );
  for (const c of controlsForAxis(
    controlsForSpine(config.controls, "lumbar"),
    "FE",
  ))
    expect(pose.coordinates[c.id]).toBeCloseTo(-2, 6);
  for (const c of controlsForSpine(config.controls, "thoracic"))
    expect(pose.coordinates[c.id]).toBeCloseTo(c.default, 6);
  const selected = config.baseline.muscles.find(
    (m) => m.id === "spine__MF_m1s_r",
  )!;
  expect(
    Math.abs(
      pose.muscles.find((m) => m.id === selected.id)!.length - selected.length,
    ),
  ).toBeGreaterThan(0.001);
  await page.getByLabel("Spine control group").selectOption("thoracic");
  pose = await changePose(
    page,
    () =>
      page
        .getByRole("slider", {
          name: "Thoracic spine Side bending",
          exact: true,
        })
        .fill("6"),
    "spine",
  );
  for (const c of controlsForAxis(
    controlsForSpine(config.controls, "thoracic"),
    "LB",
  ))
    expect(pose.coordinates[c.id]).toBeCloseTo(0.5, 6);
  expect(pose.coordinates.L3_L4_FE).toBeCloseTo(-2, 6);
  await page
    .getByRole("button", { name: "Fine-tune individual joints", exact: true })
    .click();
  await changePose(page, () => page.locator("#L3_L4_FE").fill("-1"), "spine");
  await page.getByLabel("Spine control group").selectOption("lumbar");
  await expect(
    page.getByRole("slider", {
      name: "Lumbar spine Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("-9");
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("kinetic-movement-v1-reference-spine"),
  );
  pose = await changePose(
    page,
    () =>
      page
        .getByRole("slider", {
          name: "Lumbar spine Flexion / extension",
          exact: true,
        })
        .fill("-15"),
    "spine",
  );
  for (const c of controlsForAxis(
    controlsForSpine(config.controls, "lumbar"),
    "FE",
  ))
    expect(pose.coordinates[c.id]).toBeCloseTo(-3, 6);
  pose = await changePose(
    page,
    () =>
      page
        .getByRole("button", { name: "Reset lumbar spine", exact: true })
        .click(),
    "spine",
  );
  for (const c of controlsForSpine(config.controls, "lumbar"))
    expect(pose.coordinates[c.id]).toBeCloseTo(c.default, 6);
  expect(pose.coordinates.T6_T7_LB).toBeCloseTo(0.5, 6);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("kinetic-movement-v1-reference-spine"),
    ),
  ).toBe(saved);
  await page.getByLabel("Spine control group").selectOption("all");
  pose = await changePose(
    page,
    () =>
      page
        .getByRole("slider", { name: "Entire spine Rotation", exact: true })
        .fill("8.5"),
    "spine",
  );
  for (const c of controlsForAxis(config.controls, "AR"))
    expect(pose.coordinates[c.id]).toBeCloseTo(0.5, 6);
  expect(pose.coordinates.T6_T7_LB).toBeCloseTo(0.5, 6);
});

test("whole-body spinal groups preserve limb positions and expose individual joint adjustments", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".bio-lab-options")
    .getByRole("button", { name: "Whole body", exact: true })
    .click();
  await ready(page, "wholebody");
  await changePose(
    page,
    () =>
      page
        .getByRole("slider", {
          name: "Right hip Flexion / extension",
          exact: true,
        })
        .fill("45"),
    "wholebody",
  );
  const lumbar = page
    .locator(".wholebody-group")
    .filter({
      has: page.locator("summary").filter({ hasText: /^Lumbar spine/ }),
    });
  await lumbar.locator(":scope > summary").click();
  await expect(lumbar.getByRole("slider")).toHaveCount(3);
  let pose = await changePose(
    page,
    () =>
      lumbar
        .getByRole("slider", {
          name: "Lumbar spine Flexion / extension",
          exact: true,
        })
        .fill("-7.5"),
    "wholebody",
  );
  expect(pose.coordinates.L1_L2_FE).toBeCloseTo(-1.5, 6);
  expect(pose.coordinates.L5_S1_FE).toBeCloseTo(-1.5, 6);
  expect(pose.coordinates.hip_flexion_r).toBeCloseTo(45, 6);
  expect(pose.coordinates.T6_T7_FE).toBeCloseTo(0, 6);
  await lumbar.locator(".bio-spine-individual > summary").click();
  await changePose(
    page,
    () => page.locator("#wholebody-L3_L4_FE").fill("-1"),
    "wholebody",
  );
  await expect(
    lumbar.getByRole("slider", {
      name: "Lumbar spine Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("-7");
  await page
    .getByRole("button", { name: "Save pose as reference", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("kinetic-wholebody-v1-reference"),
  );
  pose = await changePose(
    page,
    () =>
      lumbar
        .getByRole("button", { name: "Reset lumbar spine", exact: true })
        .click(),
    "wholebody",
  );
  expect(pose.coordinates.L3_L4_FE).toBeCloseTo(0, 6);
  expect(pose.coordinates.hip_flexion_r).toBeCloseTo(45, 6);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("kinetic-wholebody-v1-reference"),
    ),
  ).toBe(saved);
});

test("group controls fit mobile and support keyboard and screen readers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpine(page);
  await page.getByLabel("Spine control group").selectOption("lumbar");
  const slider = page.getByRole("slider", {
    name: "Lumbar spine Flexion / extension",
    exact: true,
  });
  await slider.focus();
  await changePose(page, () => page.keyboard.press("ArrowRight"), "spine");
  await expect(slider).toHaveValue("0.1");
  await expect(slider).toHaveAttribute(
    "aria-valuetext",
    "0.1 degrees total across 5 joints",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page
    .locator(".bio-spine-group-controls")
    .screenshot({ path: ".playwright/spine-group-mobile.png" });
});
