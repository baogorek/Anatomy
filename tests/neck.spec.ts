import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Neck", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "52 muscle compartments",
  );
  await page.locator(".bio-presets summary").click();
}
test("neck uses bilateral SCM and scalene anatomy, separate upper/lower motion, and a real cervical close-up", async ({
  page,
  request,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Explore the neck.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bio-sliders input")).toHaveCount(6);
  const config = await (
    await request.get("/api/biomechanics/config?region=neck")
  ).json();
  expect(config.side).toBe("Both");
  for (const c of config.controls)
    expect(config.coordinateUnits[c.id]).toBe("°");
  await page
    .getByRole("button", { name: "Turn the head left", exact: true })
    .click();
  await expect(page.locator(".bio-selected")).toContainText("−6.1 mm");
  await expect(page.locator("#yaw1")).toHaveValue("20");
  await expect(page.locator("#yaw2")).toHaveValue("10");
  await page.locator(".bio-search input").fill("sternocleidomastoid");
  await expect(page.locator(".bio-muscle-list button")).toHaveCount(6);
  await page
    .locator(".bio-muscle-list button")
    .filter({ hasText: "Left SCM · sternal–mastoid" })
    .click();
  await expect(page.locator(".bio-selected")).toContainText("+6.6 mm");
  await expect(page.locator(".bio-anatomy-canvas canvas")).toHaveAttribute(
    "aria-label",
    /Left SCM/,
  );
  await expect(
    page.getByRole("region", { name: "Selected muscle anatomy" }),
  ).toContainText("broader muscle");
  await page
    .getByRole("button", { name: "Tilt the head right", exact: true })
    .click();
  await expect(page.locator(".bio-selected")).toContainText("−5.2 mm");
  await expect(page.locator(".bio-anatomy-canvas canvas")).toHaveAttribute(
    "aria-label",
    /Right Anterior scalene/,
  );
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption("cerv2.vtp");
  const before = await page.locator(".bio-canvas canvas").screenshot();
  await page.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page.screenshot({
    path: ".playwright/neck-scalenes.png",
    fullPage: true,
  });
});
test("upper nod leaves scalene unchanged; references persist separately and missing semispinalis surface is explicit", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("button", { name: "Nod through the upper neck", exact: true })
    .click();
  await expect(page.locator(".bio-selected")).toContainText(
    "Shorter than reference",
  );
  await expect(page.locator("#pitch1")).toHaveValue("-12");
  await page
    .locator(".bio-muscle-list button")
    .filter({ hasText: "Right Anterior scalene" })
    .click();
  await expect(page.locator(".bio-selected")).toContainText("Little change");
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await page.locator(".bio-search input").fill("Semispinalis capitis");
  await page.locator(".bio-muscle-list button").first().click();
  await expect(
    page.getByRole("region", { name: "Selected muscle anatomy" }),
  ).toContainText("no matching semispinalis capitis surface");
  await expect(page.locator(".bio-anatomy-canvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Shoulder", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "33 muscle compartments",
  );
  await page.getByRole("button", { name: "Neck", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "52 muscle compartments",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kinetic-movement-v1-reference-neck")!),
  );
  expect(saved.pose.coordinates.pitch1).toBeCloseTo(-12, 4);
  expect(saved.pose.region).toBe("neck");
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
});
test("six neck poses have consistent native outcomes", async ({
  page,
  request,
}) => {
  await open(page);
  const quizzes = await page.evaluate(async () => {
    const { quizPoses } = await import("/src/jointLearning.ts");
    return quizPoses.neck;
  });
  const config = await (
    await request.get("/api/biomechanics/config?region=neck")
  ).json();
  const expected = [
    "Shorter",
    "Longer",
    "Shorter",
    "Longer",
    "Shorter",
    "Little change",
  ];
  for (const [i, q] of quizzes.entries()) {
    const p = await (
      await request.post("/api/biomechanics/pose", {
        data: { region: "neck", ...q.request },
      })
    ).json();
    const a = p.muscles.find((m: any) => m.id === q.muscle),
      b = config.baseline.muscles.find((m: any) => m.id === q.muscle);
    expect(a.available && b.available).toBe(true);
    for (const [n, v] of Object.entries(q.request.coordinates!))
      expect(p.coordinates[n]).toBeCloseTo(v as number, 4);
    const delta = a.length - b.length;
    expect(
      delta > 0.001 ? "Longer" : delta < -0.001 ? "Shorter" : "Little change",
    ).toBe(expected[i]);
  }
});
test("neck source angles reject unsupported inputs and preserve the fixed torso", async ({
  request,
}) => {
  const c = await (
    await request.get("/api/biomechanics/config?region=neck")
  ).json();
  const p = await (
    await request.post("/api/biomechanics/pose", {
      data: {
        region: "neck",
        coordinates: { pitch1: -10, pitch2: -20, yaw1: 25, roll2: 12 },
      },
    })
  ).json();
  for (const name of [
    "gndpitch",
    "gndroll",
    "gndyaw",
    "spine_tx",
    "spine_ty",
    "spine_tz",
  ])
    expect(p.coordinates[name]).toBeCloseTo(c.baseline.coordinates[name], 6);
  for (const coordinates of [
    { yaw1: 31 },
    { pitch2: -26 },
    { gndpitch: 10 },
    { shoulder_elv: 50 },
  ])
    expect(
      (
        await request.post("/api/biomechanics/pose", {
          data: { region: "neck", coordinates },
        })
      ).status(),
    ).toBe(400);
});
