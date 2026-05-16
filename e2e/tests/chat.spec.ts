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
});
