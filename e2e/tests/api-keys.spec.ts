import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

test.describe("API key management", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, EXISTING_USER);
  });

  test("settings page renders with provider fields", async ({ page }) => {
    await page.goto("/account/models");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Anthropic (Claude) API Key")).toBeVisible();
    await expect(page.getByText("Google (Gemini) API Key")).toBeVisible();
    await expect(page.getByText("OpenAI API Key")).toBeVisible();
  });

  test("settings page shows model preferences section", async ({ page }) => {
    await page.goto("/account/models");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Model Preferences")).toBeVisible();
  });

  test("settings page shows API keys section", async ({ page }) => {
    await page.goto("/account/models");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("API Keys")).toBeVisible();
  });
});
