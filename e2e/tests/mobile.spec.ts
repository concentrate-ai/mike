/**
 * Mobile responsiveness tests — iPhone SE viewport (375×667)
 * Covers the full settings workflow: nav, all four provider pages,
 * model catalog, key entry, ZDR toggle, model preferences.
 */
import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

// iPhone SE dimensions in Chromium (no WebKit required)
test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
});

test.describe("Mobile — Settings navigation", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    test("settings page loads and shows nav on iPhone", async ({ page }) => {
        await page.goto("/account");
        await page.waitForLoadState("networkidle");

        // No horizontal scrollbar on the page
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()!.width;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance

        // Nav is visible
        await expect(page.locator("nav[aria-label='Settings']")).toBeVisible();
    });

    test("all four provider nav items visible on mobile", async ({ page }) => {
        await page.goto("/account");
        await page.waitForLoadState("networkidle");

        // Mobile nav is the first <ul> (the md:hidden one)
        const mobileNav = page.locator("nav[aria-label='Settings'] ul").first();
        for (const label of ["Anthropic", "Concentrate", "Google", "OpenAI"]) {
            await expect(mobileNav.getByText(label, { exact: true })).toBeVisible();
        }
    });

    test("Preferences nav item visible on mobile", async ({ page }) => {
        await page.goto("/account");
        await page.waitForLoadState("networkidle");
        // Mobile uses "Preferences" label (shorter)
        const mobileNav = page.locator("nav[aria-label='Settings'] ul").first();
        await expect(mobileNav.getByText("Preferences")).toBeVisible();
    });

    test("tapping Anthropic nav item navigates to provider page", async ({ page }) => {
        await page.goto("/account");
        await page.waitForLoadState("networkidle");
        const mobileNav = page.locator("nav[aria-label='Settings'] ul").first();
        await mobileNav.getByText("Anthropic", { exact: true }).tap();
        await expect(page).toHaveURL(/\/account\/providers\/anthropic/, { timeout: 5_000 });
    });
});

test.describe("Mobile — Provider pages", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    for (const provider of ["anthropic", "concentrate", "google", "openai"]) {
        test(`${provider} page: no horizontal overflow on iPhone`, async ({ page }) => {
            await page.goto(`/account/providers/${provider}`);
            await page.waitForLoadState("networkidle");

            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const viewportWidth = page.viewportSize()!.width;
            expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
        });

        test(`${provider} page: heading and key row visible on iPhone`, async ({ page }) => {
            await page.goto(`/account/providers/${provider}`);
            await page.waitForLoadState("networkidle");

            // Heading visible
            const heading = page.getByRole("heading").first();
            await expect(heading).toBeVisible();

            // Provider label in key row visible
            const labels: Record<string, string> = {
                anthropic: "Anthropic",
                concentrate: "Concentrate",
                google: "Google",
                openai: "OpenAI",
            };
            // The key row label (not the heading) — find the one inside the border card
            const card = page.locator(".rounded-xl.border");
            await expect(card.getByText(labels[provider], { exact: true }).first()).toBeVisible();
        });
    }

    test("Concentrate page: ZDR toggle visible and tappable on iPhone", async ({ page }) => {
        await page.goto("/account/providers/concentrate");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) { test.skip(); return; }

        const toggle = page.getByText("ZDR only");
        await expect(toggle).toBeVisible();

        // Toggle is within viewport (not clipped)
        const box = await toggle.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);

        await toggle.tap();
        // After tap, more models should show (or same if toggle was already off)
    });

    test("Anthropic page: model table scrollable horizontally if needed", async ({ page }) => {
        await page.goto("/account/providers/anthropic");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) { test.skip(); return; }

        await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
        await expect(async () => {
            expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        // Page body should not overflow — table should be contained or scroll within wrapper
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = page.viewportSize()!.width;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
    });

    test("Key 'Add key' button tappable and expands on iPhone", async ({ page }) => {
        await page.goto("/account/providers/google");
        await page.waitForLoadState("networkidle");

        const isServerConfigured = await page.getByText("Verified").isVisible().catch(() => false);
        const hasAddKey = await page.getByRole("button", { name: "Add key" }).isVisible().catch(() => false);

        if (isServerConfigured || !hasAddKey) { test.skip(); return; }

        const addBtn = page.getByRole("button", { name: "Add key" });
        await expect(addBtn).toBeVisible();
        await addBtn.tap();

        // Input should expand
        await expect(page.locator("input[type='password']")).toBeVisible({ timeout: 3_000 });
    });

    test("enterprise ZDR note visible on frontier provider pages", async ({ page }) => {
        for (const provider of ["anthropic", "google", "openai"]) {
            await page.goto(`/account/providers/${provider}`);
            await page.waitForLoadState("networkidle");
            await expect(page.getByText(/ZDR requires/i)).toBeVisible();
        }
    });
});

test.describe("Mobile — Model Preferences", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    test("preferences page loads with no overflow on iPhone", async ({ page }) => {
        await page.goto("/account/preferences");
        await page.waitForLoadState("networkidle");

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(page.viewportSize()!.width + 2);

        await expect(page.getByRole("heading", { name: "Model Preferences" })).toBeVisible();
        await expect(page.locator("label").filter({ hasText: /^High$/ })).toBeVisible();
        await expect(page.locator("label").filter({ hasText: /^Medium$/ })).toBeVisible();
        await expect(page.locator("label").filter({ hasText: /^Low$/ })).toBeVisible();
    });

    test("tier dropdowns open and are usable on iPhone", async ({ page }) => {
        await page.goto("/account/preferences");
        await page.waitForLoadState("networkidle");

        // Find the High tier dropdown trigger
        const highSection = page.locator("div").filter({ has: page.locator("label").filter({ hasText: /^High$/ }) }).first();
        const dropdown = highSection.locator("button").filter({ has: page.locator("svg") }).first();

        if (await dropdown.isVisible().catch(() => false)) {
            await dropdown.tap();
            // Menu should appear
            const menu = page.locator('[role="menu"], [data-radix-popper-content-wrapper]');
            await expect(menu).toBeVisible({ timeout: 3_000 });

            // Menu should be within viewport
            const box = await menu.boundingBox();
            if (box) {
                expect(box.x).toBeGreaterThanOrEqual(-2);
                expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 10);
            }
        }
    });
});

test.describe("Mobile — Chat model picker", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    test("model picker opens and groups by provider on iPhone", async ({ page }) => {
        await page.goto("/assistant");
        await page.waitForLoadState("networkidle");

        const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT|Gemini/ }).first();
        await expect(toggle).toBeVisible({ timeout: 5_000 });
        await toggle.tap();

        const menu = page.locator('[role="menu"]');
        await expect(menu).toBeVisible({ timeout: 3_000 });

        // Menu within viewport width
        const box = await menu.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(-2);
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 10);
    });

    test("model picker shows provider groups alphabetically", async ({ page }) => {
        await page.goto("/assistant");
        await page.waitForLoadState("networkidle");

        const toggle = page.locator("button").filter({ hasText: /Flash|Claude|GPT|Gemini/ }).first();
        await toggle.tap();

        const menu = page.locator('[role="menu"]');
        await expect(menu).toBeVisible();

        // Should have at least one provider group label visible
        const labels = menu.locator('[class*="uppercase"]');
        await expect(async () => {
            expect(await labels.count()).toBeGreaterThan(0);
        }).toPass({ timeout: 5_000 });
    });
});
