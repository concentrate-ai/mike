import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

test.describe("Model picker", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, EXISTING_USER);
  });

  test("model picker opens and shows groups", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    await expect(menu.getByText("Anthropic", { exact: true })).toBeVisible();
    await expect(menu.getByText("Google", { exact: true })).toBeVisible();
    await expect(menu.getByText("OpenAI", { exact: true })).toBeVisible();
  });

  test("model selection changes the toggle label", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    await menu.getByText("Claude Sonnet 4.6").click();

    await expect(
      page.locator("button").filter({ hasText: "Claude Sonnet 4.6" }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("model picker shows more than 10 models with Concentrate", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    const items = menu.locator('[role="menuitem"]');

    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(10);
    }).toPass({ timeout: 10_000 });
  });

  test("model picker dropdown is scrollable", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');

    const items = menu.locator('[role="menuitem"]');
    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(10);
    }).toPass({ timeout: 10_000 });

    const isScrollable = await menu.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(isScrollable).toBe(true);
  });

  test("star button toggles a model as favorite", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const starBtn = menu.locator('button[aria-label="Add to favorites"]').first();
    await expect(starBtn).toBeVisible({ timeout: 5_000 });
    await starBtn.click();

    await toggle.click();
    await expect(menu.getByText("Favorites", { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test("ZDR shield icon is shown on eligible models", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    const items = menu.locator('[role="menuitem"]');
    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(6);
    }).toPass({ timeout: 10_000 });

    const zdrIcons = menu.locator('[aria-label="Zero data retention"]');
    const count = await zdrIcons.count();
    expect(count).toBeGreaterThan(0);
  });
});
