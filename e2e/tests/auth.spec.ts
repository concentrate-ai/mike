import { test, expect } from "@playwright/test";
import { signIn, signUp, EXISTING_USER } from "../helpers/auth";

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create Account" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
  });

  test("sign in with existing account", async ({ page }) => {
    await signIn(page, EXISTING_USER);
    await expect(page.getByText("Hi,")).toBeVisible({ timeout: 10_000 });
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@email.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator(".text-red-600")).toBeVisible({ timeout: 5_000 });
  });

  test("sign up with new account", async ({ page }) => {
    const user = {
      email: `e2e-signup-${Date.now()}@test.mike.local`,
      password: "e2e-pass-123456",
      name: "Signup Test",
    };
    await signUp(page, user);
    await expect(page.getByText("Hi,")).toBeVisible({ timeout: 10_000 });
  });

  test("redirect to login when unauthenticated", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
