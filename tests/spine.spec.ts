import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "552 muscle compartments",
  );
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
  await page.locator(".bio-presets summary").click();
  await page
    .getByRole("button", { name: "Fine-tune individual joints", exact: true })
    .click();
}
test("spinal levels expose three native angles and preserve other levels and saved references", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Explore the spine.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bio-sliders input")).toHaveCount(3);
  await expect(page.locator(".bio-sliders label b")).toHaveCount(0);
  await expect(
    page
      .getByRole("combobox", { name: "Spinal joint", exact: true })
      .locator("option"),
  ).toHaveCount(17);
  const config = await (
    await request.get("/api/biomechanics/config?region=spine")
  ).json();
  expect(config.controls).toHaveLength(51);
  expect(config.side).toBe("Both");
  for (const c of config.controls)
    expect(config.coordinateUnits[c.id]).toBe("°");
  await page.getByRole("button", { name: "Flex L3–L4", exact: true }).click();
  await expect(page.locator(".bio-delta")).toContainText("+2.4 mm");
  await page
    .getByRole("combobox", { name: "Spinal joint", exact: true })
    .selectOption("T6_T7");
  await page
    .getByRole("slider", { name: "Left / right axial rotation", exact: true })
    .fill("1");
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Spinal joint", exact: true })
    .selectOption("L3_L4");
  await expect(
    page.getByRole("slider", { name: "Flexion / extension", exact: true }),
  ).toHaveValue("-3");
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kinetic-movement-v1-reference-spine")!),
  );
  expect(saved.request.coordinates.L3_L4_FE).toBe(-3);
  expect(saved.request.coordinates.T6_T7_AR).toBe(1);
  await page.getByRole("button", { name: "Neck", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "52 muscle compartments",
  );
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  await page.reload();
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Spine", exact: true }).click();
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  expect(errors).toEqual([]);
});
test("rotatores and other small muscles have atlas anatomy without fabricated movement results", async ({
  page,
}) => {
  await open(page);
  await page.locator(".bio-spine-atlas summary").click();
  for (const name of [
    "Rotatores",
    "Interspinales",
    "Lumbar intertransversarii",
    "Semispinalis thoracis",
    "Spinalis thoracis",
    "Levatores costarum",
    "Serratus posterior",
    "Innermost intercostals",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".bio-anatomy-canvas canvas")).toHaveAttribute(
      "aria-label",
      `Resting atlas anatomy: ${name}`,
    );
    await expect(
      page.getByRole("region", { name: "Selected muscle anatomy" }),
    ).toContainText("No separate force path");
    await expect(page.locator(".bio-selected")).toContainText(
      "Right Multifidus lumborum",
    );
  }
  await page.getByRole("button", { name: "Rotatores", exact: true }).click();
  await page.screenshot({
    path: ".playwright/spine-rotatores.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Show muscle anatomy", exact: true })
    .count()
    .then(async (n) => {
      if (n)
        await page
          .getByRole("button", { name: "Show muscle anatomy", exact: true })
          .click();
    });
  await page.locator(".bio-search input").fill("multifidus");
  await expect(page.locator(".bio-muscle-list button")).toHaveCount(88);
  await page
    .locator(".bio-muscle-list button")
    .filter({ hasText: "Right Multifidus thoracis · multifidus_T8_T6" })
    .click();
  await expect(page.locator(".bio-anatomy-canvas canvas")).toHaveAttribute(
    "aria-label",
    /Right Multifidus thoracis/,
  );
  await page
    .getByRole("button", { name: "Rotate T6–T7 left", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Spinal joint", exact: true }),
  ).toHaveValue("T6_T7");
  await expect(
    page.getByRole("button", {
      name: "Save current as reference",
      exact: true,
    }),
  ).toBeEnabled();
  const before = await page.locator(".bio-canvas canvas").screenshot();
  await page.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  await page.screenshot({
    path: ".playwright/spine-deep-native.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Whole spine", exact: true }).click();
});
test("spine rejects unknown levels and out-of-range coordinates", async ({
  request,
}) => {
  for (const data of [
    { spineLevel: "C1_C2" },
    { coordinates: { L3_L4_FE: 4 } },
    { coordinates: { Abs_FE: 2 } },
    { coordinates: { L3_L4_FE: true } },
  ]) {
    expect(
      (
        await request.post("/api/biomechanics/pose", {
          data: { region: "spine", ...data },
        })
      ).status(),
    ).toBe(400);
  }
});
