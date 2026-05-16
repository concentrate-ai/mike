import { type Page, expect } from "@playwright/test";

export const TEST_USER = {
  email: `e2e-${Date.now()}@test.mike.local`,
  password: "test-password-123",
  name: "E2E Test User",
};

// Set E2E_USER_EMAIL and E2E_USER_PASSWORD in your environment to run
// tests that require an existing account (e.g. CI with a seeded test user).
export const EXISTING_USER = {
  email: process.env.E2E_USER_EMAIL ?? "test@example.com",
  password: process.env.E2E_USER_PASSWORD ?? "changeme",
};

export async function signUp(
  page: Page,
  user = TEST_USER,
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(user.name ?? "");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm Password").fill(user.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/assistant/, { timeout: 15_000 });
}

export async function signIn(
  page: Page,
  user: { email: string; password: string } = EXISTING_USER,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/assistant/, { timeout: 15_000 });
}

export async function signOut(page: Page): Promise<void> {
  const avatar = page.locator("button").filter({ has: page.locator("img, svg, span") }).last();
  await avatar.click();
  await page.getByText("Log out").click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}
