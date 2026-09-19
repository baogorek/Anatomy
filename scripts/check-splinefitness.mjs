// Run against the integrated local preview or deployed SplineFitness origin.
// Uses fresh guest browser contexts and never signs in or changes cloud records.
import { chromium, request } from "playwright";
import { expect } from "@playwright/test";

const origin = process.argv[2] || "http://localhost:3000";
const api = await request.newContext({ baseURL: origin });
const health = await api.get("/api/biomechanics/health");
expect(health.status()).toBe(200);
expect((await health.json()).regions).toEqual(["shoulder", "hip", "arm", "neck", "spine", "wholebody"]);
for (const region of ["shoulder", "hip", "arm", "neck", "spine", "wholebody"]) {
  const config = await api.get(`/api/biomechanics/config?region=${region}`);
  expect(config.status(), region).toBe(200);
  const value = await config.json();
  expect(value.region).toBe(region);
  expect(value.meshes.length).toBeGreaterThan(0);
  const pose = await api.post("/api/biomechanics/pose", { data: { region, coordinates: Object.fromEntries(value.controls.map(c => [c.id, c.default])) } });
  expect(pose.status(), region).toBe(200);
  expect((await pose.json()).version).toBe(value.version);
}
console.log("All six native models load and evaluate through SplineFitness.");

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await expect(page.getByRole("heading", { name: "Frontier Cards", exact: true })).toBeVisible();
    const titles = await page.locator("h2").allTextContents();
    for (const title of ["Frontier Cards", "4x4 Interval", "SIT Sprint", "LISS + Core Endurance", "VO2 Max", "Freeform", "Jeff Cavaliere's Bodyweight Circuit", "Workout Calendar", "Movement Lab"]) {
      expect(titles).toContain(title);
    }
    await page.screenshot({ path: `/tmp/splinefitness-integrated-home-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: /Movement Lab Interactive anatomy/ }).click();
    await expect(page).toHaveURL(new RegExp("/movement-lab/?$"));
    await expect(page.locator(".bio-status")).toContainText("33 muscle compartments", { timeout: 30000 });
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe("/manifest.json");
    const slider = page.getByRole("slider", { name: "Shoulder elevation (abduction / flexion)", exact: true });
    await slider.fill("65");
    await expect(page.locator(".bio-selected .bio-delta")).toContainText("−25.3 mm");
    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Sources & model credits", exact: true }).click();
    const credits = await popup;
    await expect(credits).toHaveURL(/\/movement-lab\/credits\/index.html$/);
    await expect(credits.getByRole("heading", { name: "Sources & model credits", exact: true })).toBeVisible();
    await expect(credits.getByRole("heading", { name: "Production HTTP service", exact: true })).toBeVisible();
    await credits.close();
    await page.getByRole("button", { name: "Anatomy reference", exact: true }).click();
    const atlas = page.getByRole("region", { name: "Anatomy reference", exact: true });
    await expect(atlas.locator("canvas")).toHaveAttribute("data-highlighted-meshes", /[1-9]/, { timeout: 30000 });
    await page.getByRole("button", { name: "Movement lab", exact: true }).click();
    if (width === 1440) {
      await page.getByRole("button", { name: "Neck", exact: true }).click();
      await expect(page.locator(".bio-status")).toContainText("52 muscle compartments");
      await page.getByLabel("Find a muscle path").fill("Left Anterior scalene");
      await page.locator(".bio-muscle-list button").click();
      await page.getByRole("button", { name: "Find longest path", exact: true }).click();
      await expect(page.locator(".bio-search-result")).toContainText("111.1 mm", { timeout: 45000 });
      await page.getByRole("button", { name: "Undo search", exact: true }).click();
      await expect(page.locator(".bio-selected .bio-delta")).toContainText("+0.0 mm");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/splinefitness-integrated-lab-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "Workout cards", exact: true }).click();
    await expect(page).toHaveURL(origin + "/");
    await page.getByRole("button", { name: /Frontier Cards Pocket record book/ }).click();
    await expect(page.getByRole("heading", { name: "Frontier Cards", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.close();
    console.log(`Home cards → working lab → credits/atlas → cards → Frontier passed at ${width}px.`);
  }
} finally {
  await browser.close();
  await api.dispose();
}
