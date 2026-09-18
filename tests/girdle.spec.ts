import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await expect(page.locator(".bio-status")).toContainText(
    "muscle compartments",
  );
}
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await ready(page);
  await page.locator(".bio-presets summary").click();
}

test("one Shoulder tab provides anatomical names, arm controls and all scapular movements", async ({
  page,
  request,
}) => {
  await open(page);
  await expect(
    page.getByRole("button", { name: "Shoulder girdle", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Explore the shoulder joint.",
      exact: true,
    }),
  ).toBeVisible();
  const labels = [
    "Plane of elevation",
    "Shoulder internal / external rotation",
    "Shoulder elevation (abduction / flexion)",
    "Scapular protraction / retraction",
    "Scapular elevation / depression",
    "Scapular upward / downward rotation",
  ];
  await expect(page.locator(".bio-slider")).toHaveCount(6);
  await expect(page.locator(".bio-slider label b")).toHaveCount(0);
  for (const name of labels)
    await expect(page.getByRole("slider", { name, exact: true })).toBeVisible();
  await expect(page.locator(".bio-assumption")).toContainText(
    "90° is forward flexion/extension",
  );
  for (const [button, id, value, muscle] of [
    [
      "Protract the scapula",
      "scapula_abduction",
      0,
      "Serratus anterior · middle",
    ],
    ["Elevate the scapula", "scapula_elevation", 6, "Levator scapulae"],
    [
      "Rotate the scapula upward",
      "scapula_upward_rot",
      35,
      "Trapezius · inferior",
    ],
  ] as const) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await ready(page);
    await expect(page.locator(".bio-selected h3")).toHaveText(muscle);
    await expect(page.locator(".bio-delta")).toContainText(
      "Shorter than reference",
    );
    const pose = await (
      await request.post("/api/biomechanics/pose", {
        data: { region: "shoulder", coordinates: { [id]: value } },
      })
    ).json();
    expect(pose.coordinates[id]).toBeCloseTo(value, 8);
  }
  for (const button of [
    "Shrug and lower the shoulder",
    "Raise the arm with the scapula",
    "Follow a forward arm raise",
  ])
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeVisible();
});

test("scapula and whole-shoulder camera controls preserve combined pose and reference", async ({
  page,
}) => {
  await open(page);
  const inputs = {
    "Plane of elevation": "87.5",
    "Shoulder elevation (abduction / flexion)": "92",
    "Scapular protraction / retraction": "-5.5",
    "Scapular elevation / depression": "7",
    "Scapular upward / downward rotation": "32.5",
  };
  for (const [name, value] of Object.entries(inputs)) {
    await page.getByRole("slider", { name, exact: true }).fill(value);
    await ready(page);
  }
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  const angles = await page
    .locator(".bio-girdle-angles output")
    .allTextContents();
  const before = await page.locator(".bio-canvas canvas").screenshot();
  await page
    .getByRole("button", { name: "Focus scapula", exact: true })
    .click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  for (const name of ["Whole shoulder", "Front", "Back", "Focus joint"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".bio-reference")).toContainText(
      "Your saved pose",
    );
    expect(
      await page.locator(".bio-girdle-angles output").allTextContents(),
    ).toEqual(angles);
    for (const [label, value] of Object.entries(inputs))
      await expect(
        page.getByRole("slider", { name: label, exact: true }),
      ).toHaveValue(value);
  }
  await page
    .getByRole("button", { name: "Focus scapula", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show muscle anatomy", exact: true })
    .click();
  await expect(page.locator(".bio-anatomy-reference")).toBeVisible();
  await page.screenshot({
    path: ".playwright/shoulder-consolidated.png",
    fullPage: true,
  });
});
