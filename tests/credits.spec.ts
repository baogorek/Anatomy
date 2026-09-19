import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../biomechanics/models/manifest.json" with { type: "json" };
import runtime from "../biomechanics/runtime-manifest.json" with { type: "json" };

test("credits work without JavaScript or native service; notices and source pins match the build", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  const apiCalls: string[] = [];
  await page.route("**/api/biomechanics/**", (route) => {
    apiCalls.push(route.request().url());
    return route.abort();
  });
  await page.goto("/credits/index.html");
  await expect(
    page.getByRole("heading", { name: "Sources & model credits", exact: true }),
  ).toBeVisible();
  for (const [key, model] of Object.entries(manifest)) {
    await expect(page.locator(`#${key}`)).toContainText(model.sha256);
    await expect(page.locator(`#${key}`)).toContainText(model.commit);
  }
  await expect(page.locator("#hip")).toContainText(
    "have not been established individually",
  );
  await expect(page.locator("#arm")).toContainText("non-commercial");
  await expect(page.locator("#wholebody")).toHaveCount(1);

  // Check every bundled link, including fragments, to catch SPA fallback HTML
  // masquerading as a successful notice download.
  for (const href of new Set(
    await page
      .locator("a[href]")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")!)),
  )) {
    if (href.startsWith("https:")) continue;
    if (href.startsWith("#")) {
      await expect(page.locator(href)).toHaveCount(1);
      continue;
    }
    const url = new URL(href, page.url());
    const response = await context.request.get(url.href);
    expect(response.ok(), href).toBe(true);
    if (url.pathname === "/") continue;
    const bytes = readFileSync(`public${decodeURIComponent(url.pathname)}`);
    expect((await response.body()).equals(bytes), href).toBe(true);
  }
  const provenance = await (
    await context.request.get("/credits/provenance.json")
  ).json();
  expect(provenance.models).toEqual(manifest);
  expect(provenance.runtime).toEqual(runtime);
  expect(provenance.publications).toHaveLength(12);
  for (const notice of provenance.notices) {
    const bytes = await (
      await context.request.get(`/credits/notices/${notice.file}`)
    ).body();
    expect(bytes.equals(readFileSync(notice.source)), notice.file).toBe(true);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      notice.sha256,
    );
  }
  expect(apiCalls).toEqual([]);
  await context.close();
});

test("credits open beside the lab and fit a mobile screen", async ({
  page,
}) => {
  await page.goto("/");
  const popup = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Sources & model credits", exact: true })
    .click();
  const credits = await popup;
  await credits.waitForLoadState();
  await expect(page).toHaveURL(/\/$/);
  await expect(credits).toHaveURL(/\/credits\/index\.html$/);
  await credits.setViewportSize({ width: 320, height: 844 });
  await expect(credits.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await credits.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await credits
    .getByRole("navigation", { name: "Credit sections" })
    .getByRole("link", { name: "Neck", exact: true })
    .click();
  await expect(credits).toHaveURL(/#neck$/);
  expect(
    (
      await new AxeBuilder({ page: credits })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await credits.close();
});
