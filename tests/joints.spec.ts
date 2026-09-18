import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await ready(page);
  await page.locator(".bio-presets summary").click();
}
async function ready(page: Page) {
  await expect(page.locator(".bio-status")).toContainText(
    "muscle compartments",
  );
}
test("joint workspace is the default; bone identification, movement comparisons and optional close-up work", async ({
  page,
}) => {
  await open(page);
  await expect(
    page.getByRole("heading", {
      name: "Explore the shoulder joint.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", {
      name: "Deltoid shoulder elevation",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption("scapula.vtp");
  const beforeFocus = await page.locator(".bio-canvas canvas").screenshot();
  await page.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(beforeFocus),
  ).toBe(false);
  await expect(
    page.getByRole("combobox", { name: "Identify a bone", exact: true }),
  ).toHaveValue("scapula.vtp");
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("button", { name: "Raise the arm", exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    }),
  ).toHaveValue("70");
  await page.getByLabel("Find a muscle path").fill("Latissimus dorsi · middle");
  await page.locator(".bio-muscle-list button").click();
  await page.getByLabel("Find a muscle path").fill("");
  await expect(page.locator(".bio-selected h3")).toContainText("Latissimus");
  await page
    .getByRole("combobox", { name: "Compare muscle paths", exact: true })
    .selectOption("Longer");
  const values = await page
    .locator(".bio-muscle-list button span:last-child")
    .allTextContents();
  expect(values.length).toBeGreaterThan(1);
  expect(values.every((v) => v.startsWith("+"))).toBe(true);
  await page
    .getByRole("button", { name: "Deltoid close-up", exact: true })
    .click();
  await expect(page.locator(".deltoid-study")).toBeVisible();
  await page
    .getByRole("button", { name: "Joint explorer", exact: true })
    .click();
  await expect(
    page.getByRole("slider", {
      name: "Shoulder elevation (abduction / flexion)",
      exact: true,
    }),
  ).toHaveValue("70");
});
test("hip and knee have distinct explorations and preserve the combined pose and reference", async ({
  page,
  request,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Hip", exact: true }).click();
  await ready(page);
  await page
    .getByRole("button", { name: "Bring the thigh forward", exact: true })
    .click();
  await ready(page);
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await page.getByRole("button", { name: "Knee", exact: true }).click();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Explore the knee joint.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", {
      name: "X Hip flexion / extension",
      exact: true,
    }),
  ).toHaveValue("70");
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  await expect(page.locator(".bio-slider").first()).toContainText(
    "Knee flexion",
  );
  await page
    .getByRole("slider", { name: "K Knee flexion", exact: true })
    .fill("90");
  await ready(page);
  const target = await (
    await request.post("/api/biomechanics/pose", {
      data: {
        region: "hip",
        coordinates: { hip_flexion_r: 70, knee_angle_r: 90 },
      },
    })
  ).json();
  const ref = await (
    await request.post("/api/biomechanics/pose", {
      data: {
        region: "hip",
        coordinates: { hip_flexion_r: 70, knee_angle_r: 0 },
      },
    })
  ).json();
  const pick = (p: any) =>
    p.muscles.find((m: any) => m.id === "recfem_r").length;
  await expect(page.locator(".bio-delta")).toContainText(
    `${Math.abs((pick(target) - pick(ref)) * 1000).toFixed(1)} mm`,
  );
  await page.getByRole("button", { name: "Hip", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "K Knee flexion", exact: true }),
  ).toHaveValue("90");
  await page.getByRole("button", { name: "Knee", exact: true }).click();
  await page
    .getByRole("button", { name: "Bend the knee", exact: true })
    .click();
  await ready(page);
  await expect(page.locator(".bio-selected h3")).toContainText(
    "Vastus lateralis",
  );
});
test("ankle shares the leg pose and compares calf muscles", async ({
  page,
  request,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Ankle", exact: true }).click();
  await ready(page);
  await expect(
    page.getByRole("heading", {
      name: "Explore the ankle joint.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".bio-slider").first()).toContainText(
    "Ankle dorsiflexion",
  );
  await page.screenshot({
    path: ".playwright/ankle-overview.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption("r_talus.vtp");
  const before = await page.locator(".bio-canvas canvas").screenshot();
  await page.getByRole("button", { name: "Focus joint", exact: true }).click();
  expect(
    (await page.locator(".bio-canvas canvas").screenshot()).equals(before),
  ).toBe(false);
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Compare straight-knee and bent-knee calf paths",
      exact: true,
    })
    .click();
  await ready(page);
  await expect(page.locator(".bio-delta")).toContainText(
    "Longer than reference",
  );
  await expect(
    page.getByRole("slider", { name: "K Knee flexion", exact: true }),
  ).toHaveValue("0");
  await page
    .getByRole("button", { name: "Save current as reference", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "K Knee flexion", exact: true })
    .fill("90");
  await ready(page);
  const poses = [];
  for (const knee of [0, 90]) {
    const response = await request.post("/api/biomechanics/pose", {
      data: {
        region: "hip",
        coordinates: { ankle_angle_r: 20, knee_angle_r: knee },
      },
    });
    expect(response.ok()).toBe(true);
    poses.push(await response.json());
  }
  const calf = (p: any) => p.muscles.find((m: any) => m.id === "gasmed_r");
  expect(poses.every((p) => calf(p).available)).toBe(true);
  await expect(page.locator(".bio-delta")).toContainText(
    `${Math.abs((calf(poses[1]).length - calf(poses[0]).length) * 1000).toFixed(1)} mm`,
  );
  await expect(page.locator(".bio-delta")).toContainText(
    "Shorter than reference",
  );
  // The focused foot must remain in frame after the knee moves it through space.
  await expect
    .poll(async () => {
      // Read the compositor screenshot: the WebGL drawing buffer is not retained.
      const png = await page.locator(".bio-canvas canvas").screenshot();
      return page.evaluate(
        async (url) => {
          const source = new Image();
          source.src = url;
          await source.decode();
          const copy = document.createElement("canvas");
          copy.width = source.width;
          copy.height = source.height;
          const ctx = copy.getContext("2d")!;
          ctx.drawImage(source, 0, 0);
          const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
          let visible = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if ([0, 1, 2].some((c) => Math.abs(pixels[i + c] - pixels[c]) > 30))
              visible++;
          return visible;
        },
        `data:image/png;base64,${png.toString("base64")}`,
      );
    })
    .toBeGreaterThan(1000);
  await page
    .getByRole("button", { name: "Show muscle anatomy", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Resting atlas anatomy: Gastrocnemius · medial head",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: ".playwright/ankle-calf.png", fullPage: true });
  for (const joint of ["Knee", "Hip", "Ankle"]) {
    await page.getByRole("button", { name: joint, exact: true }).click();
    await expect(
      page.getByRole("slider", {
        name: "A Ankle dorsiflexion / plantarflexion",
        exact: true,
      }),
    ).toHaveValue("20");
    await expect(
      page.getByRole("slider", { name: "K Knee flexion", exact: true }),
    ).toHaveValue("90");
    await expect(page.locator(".bio-reference")).toContainText(
      "Your saved pose",
    );
    await expect(page.locator(".bio-selected h3")).toContainText(
      "Gastrocnemius",
    );
  }
  await page
    .getByRole("button", { name: "Hide muscle anatomy", exact: true })
    .click();
});
test("tibialis anterior distinguishes anatomical attachments from model endpoints and exposes evidence limits", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Ankle", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: /^Tibialis anterior/ }).click();
  await expect(page.locator(".bio-path-explanation")).toContainText(
    "not the full anatomical attachment areas",
  );
  await expect(page.locator(".bio-attachment")).toContainText(
    "Model endpoint segments:",
  );
  const evidence = page.locator(".bio-muscle-evidence");
  await expect(evidence).toContainText(
    "Medial cuneiform and base of the first metatarsal",
  );
  await expect(evidence).toContainText("It does not cross the knee");
  await evidence
    .getByText("Evidence and model limits", { exact: true })
    .click();
  await expect(evidence).toContainText("eversion pull in everted positions");
  await expect(
    evidence.getByRole("link", { name: "Position-dependent action" }),
  ).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/19019375/");
  await expect(page.locator(".bio-anatomy-note")).toContainText("not aligned");
  await page.screenshot({
    path: ".playwright/tibialis-evidence-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await evidence.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .include(".movement-lab")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: ".playwright/tibialis-evidence-mobile.png",
    fullPage: true,
  });
});

test("references saved before ankle expansion are re-evaluated with all leg muscles", async ({
  page,
  request,
}) => {
  const coordinates = { hip_flexion_r: 70, knee_angle_r: 30 };
  const response = await request.post("/api/biomechanics/pose", {
    data: { region: "hip", coordinates },
  });
  const pose = await response.json();
  const currentVersion = pose.version;
  const currentBuild = pose.calculationBuild;
  // Simulate the original saved-reference schema, including stale length values.
  pose.version = pose.modelVersion;
  delete pose.modelVersion;
  delete pose.calculationBuild;
  const added = new Set([
    "edl_r",
    "ehl_r",
    "fdl_r",
    "fhl_r",
    "gaslat_r",
    "gasmed_r",
    "perbrev_r",
    "perlong_r",
    "soleus_r",
    "tibant_r",
    "tibpost_r",
  ]);
  pose.muscles = pose.muscles.filter((m: { id: string }) => !added.has(m.id));
  pose.muscles.forEach((m: { length: number }) => {
    m.length += 0.1;
  });
  expect(pose.muscles).toHaveLength(29);
  await page.goto("/");
  await page.evaluate(
    (saved) =>
      localStorage.setItem(
        "kinetic-movement-v1-reference-hip",
        JSON.stringify(saved),
      ),
    {
      request: { coordinates },
      pose,
      label: "Your saved pose",
    },
  );
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Ankle", exact: true }).click();
  await ready(page);
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  await expect(page.locator(".bio-selected h3")).toHaveText("Soleus");
  await expect(page.locator(".bio-delta")).toContainText(
    "Little change from reference",
  );
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kinetic-movement-v1-reference-hip")!),
  );
  expect(restored.pose.version).toBe(currentVersion);
  expect(restored.pose.calculationBuild).toBe(currentBuild);
  expect(restored.pose.muscles).toHaveLength(40);
});

test("a reference from an earlier engine build is recalculated while old attempts stay intact", async ({
  page,
  request,
}) => {
  const config = await (
    await request.get("/api/biomechanics/config?region=hip")
  ).json();
  const stale = structuredClone(config.baseline);
  stale.version = "0".repeat(64);
  stale.calculationBuild = "1".repeat(64);
  stale.muscles.forEach((m: { length: number }) => {
    m.length += 0.1;
  });
  const oldAttempt = {
    question: "ankle-gastroc-dorsiflexion",
    version: stale.version,
    modelVersion: stale.modelVersion,
    calculationBuild: stale.calculationBuild,
    answer: "Longer",
    expected: "Longer",
    assisted: false,
    at: "2026-09-01T12:00:00Z",
  };
  await page.goto("/");
  await page.evaluate(
    ({ stale, oldAttempt }) => {
      localStorage.setItem(
        "kinetic-movement-v1-reference-hip",
        JSON.stringify({ request: {}, pose: stale, label: "Your saved pose" }),
      );
      localStorage.setItem("kinetic-movement-v1", JSON.stringify([oldAttempt]));
    },
    { stale, oldAttempt },
  );
  await page.getByRole("button", { name: "Movement lab", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Ankle", exact: true }).click();
  await ready(page);
  await expect(page.locator(".bio-reference")).toContainText("Your saved pose");
  await expect(page.locator(".bio-delta")).toContainText(
    "Little change from reference",
  );
  const attempts = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kinetic-movement-v1")!),
  );
  expect(attempts[0]).toEqual(oldAttempt);
  expect(attempts).toHaveLength(1);
});

test("all eight workspaces remain keyboard accessible and fit mobile", async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const joint of [
    "Neck",
    "Spine",
    "Shoulder",
    "Elbow",
    "Wrist",
    "Hip",
    "Knee",
    "Ankle",
  ]) {
    await page.getByRole("button", { name: joint, exact: true }).click();
    await ready(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(391);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Bones only", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Identify a bone", exact: true })
    .selectOption("r_patella.vtp");
  await page.screenshot({
    path: ".playwright/joints-mobile.png",
    fullPage: true,
  });
});
