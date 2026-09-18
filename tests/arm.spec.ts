import { test, expect, type Page } from "@playwright/test";
async function open(page: Page, joint = "Elbow") {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: joint, exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "17 muscle compartments",
  );
  await page.locator(".bio-presets summary").click();
}
async function slider(page: Page, id: string, value: number) {
  await page.locator(`#${id}`).fill(String(value));
  await expect(page.locator(".bio-status")).toContainText(
    "17 muscle compartments",
  );
}
test("elbow and wrist share a pose and reference; anatomical views and bone focus work", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Bend the elbow", exact: true })
    .click();
  await expect(page.locator("#elbow_flexion")).toHaveValue("90");
  await expect(page.locator(".bio-status")).toContainText(
    "17 muscle compartments",
  );
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await page.getByRole("button", { name: "Wrist", exact: true }).click();
  await expect(page.locator("#elbow_flexion")).toHaveValue("90");
  await expect(page.locator(".bio-sliders input").first()).toHaveAttribute(
    "id",
    "flexion",
  );
  await expect(page.locator(".bio-selected h3")).toContainText(
    "Flexor carpi radialis",
  );
  await slider(page, "flexion", 40);
  await expect(page.locator(".bio-selected")).toContainText("Shorter");
  await page
    .locator(".bio-muscle-list button")
    .filter({ hasText: "Flexor carpi radialis" })
    .click();
  await expect(page.locator(".bio-anatomy-canvas canvas")).toBeVisible();
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption("lunate.vtp");
  const before = await page.locator(".bio-canvas canvas").screenshot();
  await page.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  await page.screenshot({
    path: ".playwright/wrist-workspace.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Elbow", exact: true }).click();
  await expect(page.locator("#flexion")).toHaveValue("40");
  await expect(page.locator(".bio-selected h3")).toContainText(
    "Flexor carpi radialis",
  );
  await page.reload();
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Elbow", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "17 muscle compartments",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kinetic-movement-v1-reference-arm")!),
  );
  expect(stored.pose.coordinates.elbow_flexion).toBeCloseTo(90, 5);
});
test("supinator is withheld in pronation, including when only the reference fails", async ({
  page,
}) => {
  await open(page);
  await page
    .locator(".bio-muscle-list button")
    .filter({ hasText: "Supinator" })
    .click();
  await slider(page, "pro_sup", 60);
  await expect(page.locator(".bio-selected")).toContainText(
    "Supinator routing is unreliable",
  );
  await expect(page.locator(".bio-actions")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await slider(page, "pro_sup", 0);
  await expect(page.locator(".bio-selected")).toContainText(
    "Supinator routing is unreliable",
  );
  await expect(page.locator(".bio-actions")).toHaveCount(0);
  await expect(page.locator(".bio-anatomy-canvas canvas")).toBeVisible();
});
test("corrected wrist extensor route and action consistency exclusions reach the UI", async ({
  page,
  request,
}) => {
  await open(page, "Wrist");
  await page
    .getByRole("button", { name: "Extend the wrist", exact: true })
    .click();
  await expect(page.locator(".bio-status")).toContainText(
    "17 muscle compartments",
  );
  await expect(page.locator(".bio-selected h3")).toContainText(
    "Extensor carpi radialis longus",
  );
  await expect(page.locator(".bio-selected")).toContainText("Shorter");
  const pose = await (
    await request.post("/api/biomechanics/pose", {
      data: { region: "arm", coordinates: { flexion: -40 } },
    })
  ).json();
  expect(pose.coordinates.flexion).toBeCloseTo(-40, 3);
  const ecrl = pose.muscles.find((m: any) => m.id === "ECRL");
  expect(ecrl.available).toBe(true);
  expect(ecrl.length).toBeLessThan(0.4);
  expect(ecrl.length).toBeGreaterThan(0.25);
  await slider(page, "pro_sup", -76);
  await page.locator(".bio-actions summary").click();
  await expect(page.locator(".bio-actions")).toContainText(
    "Unavailable · consistency check",
  );
});
test("eight arm poses agree with the native finite length changes", async ({
  page,
  request,
}) => {
  await open(page);
  const quizzes = await page.evaluate(async () => {
    const { quizPoses } = await import("/src/jointLearning.ts");
    return [...quizPoses.elbow, ...quizPoses.wrist];
  });
  const config = await (
    await request.get("/api/biomechanics/config?region=arm")
  ).json();
  const expected = [
    "Shorter",
    "Longer",
    "Shorter",
    "Longer",
    "Shorter",
    "Longer",
    "Shorter",
    "Shorter",
  ];
  for (const [i, q] of quizzes.entries()) {
    const pose = await (
      await request.post("/api/biomechanics/pose", {
        data: { region: "arm", ...q.request },
      })
    ).json();
    const a = pose.muscles.find((m: any) => m.id === q.muscle),
      b = config.baseline.muscles.find((m: any) => m.id === q.muscle);
    expect(a.available && b.available).toBe(true);
    const d = a.length - b.length;
    expect(
      d > 0.001 ? "Longer" : d < -0.001 ? "Shorter" : "Little change",
    ).toBe(expected[i]);
  }
});
