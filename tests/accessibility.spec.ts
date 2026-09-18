import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("main screens pass the automated WCAG A/AA checks", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Movement lab", "Anatomy reference"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations, `${name} accessibility violations`).toEqual([]);
  }
});
