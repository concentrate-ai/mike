import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

test.describe("Concentrate integration", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, EXISTING_USER);
  });

  test("dynamic models load when Concentrate key is configured", async ({
    page,
  }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const items = menu.locator('[role="menuitem"]');
    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(6);
    }).toPass({ timeout: 10_000 });
  });

  test("Concentrate models are grouped by author", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');

    const items = menu.locator('[role="menuitem"]');
    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(10);
    }).toPass({ timeout: 10_000 });

    const groupLabels = menu.locator('[class*="uppercase"]');
    const groupCount = await groupLabels.count();
    expect(groupCount).toBeGreaterThanOrEqual(5);
  });

  test("can select a Concentrate-only model", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');

    const items = menu.locator('[role="menuitem"]');
    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(6);
    }).toPass({ timeout: 10_000 });

    await menu.evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
    await page.waitForTimeout(300);

    const deepseekItem = menu.getByText("DeepSeek R1").first();
    if (await deepseekItem.isVisible().catch(() => false)) {
      await deepseekItem.click();
      await expect(
        page.locator("button").filter({ hasText: "DeepSeek R1" }),
      ).toBeVisible({ timeout: 3_000 });
    }
  });

  test("Concentrate API key field on settings page", async ({ page }) => {
    await page.goto("/account/models");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Concentrate API Key")).toBeVisible();
  });
});
