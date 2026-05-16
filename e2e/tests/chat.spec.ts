import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

test.describe("Chat", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, EXISTING_USER);
  });

  test("assistant page shows greeting", async ({ page }) => {
    await expect(page.getByText("Hi,")).toBeVisible({ timeout: 10_000 });
  });

  test("chat input is present", async ({ page }) => {
    await expect(
      page.getByPlaceholder(/question|document/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("send button is visible", async ({ page }) => {
    const sendBtn = page.locator('button[type="submit"], button:has(svg)').last();
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
  });

  test("sidebar shows assistant history section", async ({ page }) => {
    await expect(page.getByText("Assistant History")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("model toggle shows dynamic model name after selection", async ({ page }) => {
    const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT/ }).first();
    await toggle.click();

    const menu = page.locator('[role="menu"]');
    const items = menu.locator('[role="menuitem"]');

    await expect(async () => {
      const count = await items.count();
      expect(count).toBeGreaterThan(6);
    }).toPass({ timeout: 10_000 });

    await menu.getByText("Claude Opus 4.7").click();

    await expect(
      page.locator("button").filter({ hasText: "Claude Opus 4.7" }),
    ).toBeVisible({ timeout: 3_000 });
  });
});
