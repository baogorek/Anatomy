import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openNeck(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await page.getByRole("button", { name: "Neck", exact: true }).click();
  await expect(page.locator(".bio-status")).toContainText(
    "52 muscle compartments",
  );
  await page.getByLabel("Find a muscle path").fill("Left Anterior scalene");
  await page.locator(".bio-muscle-list button").click();
  return page.getByRole("region", {
    name: "Find longest muscle path",
    exact: true,
  });
}

test("native neck search applies the longest found pose, preserves the reference and supports Undo", async ({
  page,
}) => {
  const search = await openNeck(page);
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("kinetic-movement-v1-reference-neck"),
  );
  await search
    .getByRole("button", { name: "Find longest path", exact: true })
    .click();
  await expect(
    search.getByRole("button", { name: "Cancel search", exact: true }),
  ).toBeVisible();
  await expect(search.locator(".bio-search-result")).toContainText("111.1 mm", {
    timeout: 35000,
  });
  await expect(page.locator("#pitch2")).toHaveValue("30");
  await expect(page.locator("#yaw2")).toHaveValue("20");
  await expect(page.locator("#roll2")).toHaveValue("20");
  await expect(page.locator("#pitch1")).toHaveValue("0");
  await expect(page.locator(".bio-selected .bio-delta")).toContainText(
    "+9.7 mm",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("kinetic-movement-v1-reference-neck"),
    ),
  ).toBe(saved);
  await page.screenshot({
    path: ".playwright/longest-path-neck.png",
    fullPage: true,
  });
  await search
    .getByRole("button", { name: "Undo search", exact: true })
    .click();
  await expect(page.locator("#pitch2")).toHaveValue("0");
  await expect(page.locator("#yaw2")).toHaveValue("0");
  await expect(page.locator("#roll2")).toHaveValue("0");
  await expect(page.locator(".bio-selected .bio-delta")).toContainText(
    "+0.0 mm",
  );
  await expect(search.locator(".bio-search-result")).toHaveCount(0);
});

test("whole-body search respects joint locks and retains its layer settings", async ({
  page,
}) => {
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
  await lab
    .getByRole("slider", {
      name: "Right ankle Dorsiflexion / plantarflexion",
      exact: true,
    })
    .fill("12");
  await expect(lab.locator(".bio-status")).toContainText("Shared pose ready");
  const search = lab.getByRole("region", {
    name: "Find longest muscle path",
    exact: true,
  });
  await search.locator("summary").click();
  await search.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(
    search.getByRole("button", { name: "Find longest path", exact: true }),
  ).toBeDisabled();
  await search
    .getByRole("checkbox", {
      name: "Right hip · Flexion / extension",
      exact: false,
    })
    .check();
  await search
    .getByRole("checkbox", { name: "Right knee · Flexion", exact: false })
    .check();
  await search.locator("summary").click();
  await search
    .getByRole("button", { name: "Find longest path", exact: true })
    .click();
  await expect(search.locator(".bio-search-result")).toContainText(
    "Longest found",
    { timeout: 35000 },
  );
  await expect(
    lab.getByRole("slider", {
      name: "Right hip Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("100");
  await expect(
    lab.getByRole("slider", {
      name: "Right ankle Dorsiflexion / plantarflexion",
      exact: true,
    }),
  ).toHaveValue("12");
  await expect(
    lab.getByRole("button", { name: "Selected muscle", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    search.getByRole("button", { name: "Undo search", exact: true }),
  ).toBeEnabled();
  await search
    .getByRole("button", { name: "Undo search", exact: true })
    .click();
  await expect(
    lab.getByRole("slider", {
      name: "Right hip Flexion / extension",
      exact: true,
    }),
  ).toHaveValue("0");
  await expect(
    lab.getByRole("slider", {
      name: "Right ankle Dorsiflexion / plantarflexion",
      exact: true,
    }),
  ).toHaveValue("12");
});

for (const action of [
  "cancel",
  "pose",
  "muscle",
  "view",
  "reference",
] as const) {
  test(`a delayed result cannot apply after changing ${action}`, async ({
    page,
    request,
  }) => {
    const search = await openNeck(page);
    const config = await (
      await request.get("/api/biomechanics/config?region=neck")
    ).json();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let polled = false;
    let cancelled = false;
    await page.route("**/api/biomechanics/longest-path", (route) =>
      route.fulfill({ json: { id: "delayed", status: "running" } }),
    );
    await page.route(
      "**/api/biomechanics/longest-path/delayed",
      async (route) => {
        if (route.request().method() === "DELETE") {
          cancelled = true;
          return route.fulfill({ json: { status: "cancelled" } });
        }
        polled = true;
        await gate;
        await route
          .fulfill({
            json: {
              status: "complete",
              result: {
                region: "neck",
                version: config.version,
                muscle: "scalenus_ant_L",
                startLength: 0.101,
                length: 0.111,
                gain: 0.01,
                coordinates: { pitch2: 30 },
                pose: config.baseline,
                evaluations: 20,
                atLimits: ["pitch2"],
                budgetLimited: false,
              },
            },
          })
          .catch(() => {});
      },
    );
    await search
      .getByRole("button", { name: "Find longest path", exact: true })
      .click();
    await expect.poll(() => polled).toBe(true);
    if (action === "cancel")
      await search
        .getByRole("button", { name: "Cancel search", exact: true })
        .click();
    if (action === "pose") await page.locator("#pitch2").fill("10");
    if (action === "muscle") {
      await page
        .getByLabel("Find a muscle path")
        .fill("Right Anterior scalene");
      await page.locator(".bio-muscle-list button").click();
    }
    if (action === "view")
      await page
        .locator(".bio-lab-options")
        .getByRole("button", { name: "Whole body", exact: true })
        .click();
    if (action === "reference")
      await page
        .getByRole("button", { name: "Anatomy reference", exact: true })
        .click();
    await expect.poll(() => cancelled).toBe(true);
    release();
    if (action === "view")
      await page.getByRole("button", { name: "Regional", exact: true }).click();
    if (action === "reference")
      await page
        .getByRole("button", { name: "Back to movement", exact: true })
        .click();
    await expect(page.locator("#pitch2")).toHaveValue(
      action === "pose" ? "10" : "0",
    );
    await expect(page.locator(".bio-search-result")).toHaveCount(0);
  });
}

test("search failure leaves the pose intact and mobile controls are accessible", async ({
  page,
}) => {
  const search = await openNeck(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await search.locator("summary").click();
  await page.route("**/api/biomechanics/longest-path", (route) =>
    route.fulfill({ status: 503, json: { error: "Search is unavailable." } }),
  );
  await search
    .getByRole("button", { name: "Find longest path", exact: true })
    .click();
  await expect(search.getByRole("alert")).toContainText(
    "Search is unavailable",
  );
  await expect(page.locator("#pitch2")).toHaveValue("0");
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
  await search.screenshot({ path: ".playwright/longest-path-mobile.png" });
});

test("solver API rejects invalid targets, bounds, locks and stale models", async ({
  request,
}) => {
  const config = await (
    await request.get("/api/biomechanics/config?region=neck")
  ).json();
  const good = {
    region: "neck",
    version: config.version,
    muscle: "scalenus_ant_L",
    coordinates: {},
  };
  for (const bad of [
    { version: "stale" },
    { muscle: "missing" },
    { controls: [] },
    { controls: ["pitch2", "pitch2"] },
    { coordinates: { pitch2: 31 } },
    { coordinates: { pitch2: true } },
    { coordinates: { unknown: 0 } },
  ]) {
    expect(
      (
        await request.post("/api/biomechanics/longest-path", {
          data: { ...good, ...bad },
        })
      ).status(),
    ).toBe(400);
  }
});

test("native background search can be cancelled while ordinary pose requests still work", async ({
  request,
}) => {
  const config = await (
    await request.get("/api/biomechanics/config?region=wholebody")
  ).json();
  const response = await request.post("/api/biomechanics/longest-path", {
    data: {
      region: "wholebody",
      version: config.version,
      muscle: "wholebody__bifemlh_r",
      coordinates: {},
    },
  });
  expect(response.status()).toBe(202);
  const { id } = await response.json();
  try {
    expect(
      (
        await request.post("/api/biomechanics/pose", {
          data: { region: "neck", coordinates: { pitch2: 10 } },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.post("/api/biomechanics/longest-path", {
          data: {
            region: "wholebody",
            version: config.version,
            muscle: "wholebody__bifemlh_r",
            coordinates: {},
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await request.delete(`/api/biomechanics/longest-path/${id}`);
  }
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/biomechanics/longest-path/${id}`)
          ).json()
        ).status,
    )
    .toBe("cancelled");
});
