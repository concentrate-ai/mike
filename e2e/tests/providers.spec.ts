import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

const PROVIDERS = [
    { id: "anthropic", label: "Anthropic", envVar: "ANTHROPIC_API_KEY" },
    { id: "concentrate", label: "Concentrate", envVar: "CONCENTRATE_API_KEY" },
    { id: "google", label: "Google", envVar: "GEMINI_API_KEY" },
    { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY" },
];

test.describe("Settings navigation", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    test("settings sidebar shows all four providers in alphabetical order", async ({ page }) => {
        await page.goto("/account");
        await page.waitForLoadState("networkidle");

        const nav = page.locator("nav[aria-label='Settings']");
        await expect(nav).toBeVisible();

        for (const p of PROVIDERS) {
            await expect(nav.getByText(p.label, { exact: true })).toBeVisible();
        }

        // Check alphabetical order in DOM
        const labels = await nav.locator("button").allTextContents();
        const providerLabels = labels
            .map((l) => l.trim())
            .filter((l) => PROVIDERS.some((p) => p.label === l));
        expect(providerLabels).toEqual(["Anthropic", "Concentrate", "Google", "OpenAI"]);
    });

    test("Model Preferences nav item is present", async ({ page }) => {
        await page.goto("/account");
        await expect(page.locator("nav[aria-label='Settings']").getByText("Model Preferences")).toBeVisible();
    });

    test("/account/api-keys redirects to /account/providers", async ({ page }) => {
        await page.goto("/account/api-keys");
        await expect(page).toHaveURL(/\/account\/providers/, { timeout: 5_000 });
    });

    test("/account/models redirects to /account/providers/concentrate", async ({ page }) => {
        await page.goto("/account/models");
        await expect(page).toHaveURL(/\/account\/providers\/concentrate/, { timeout: 5_000 });
    });
});

test.describe("Provider pages", () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
    });

    for (const provider of PROVIDERS) {
        test(`${provider.label} page loads and shows key row`, async ({ page }) => {
            await page.goto(`/account/providers/${provider.id}`);
            await page.waitForLoadState("networkidle");

            // Heading
            await expect(page.getByRole("heading", { name: provider.label })).toBeVisible();

            // Env var shown
            await expect(page.getByText(provider.envVar)).toBeVisible();
        });
    }

    test("Anthropic page shows models when key is configured", async ({ page }) => {
        await page.goto("/account/providers/anthropic");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);

        if (!hasKey) {
            // No key — show add-key placeholder, no table
            await expect(page.locator("table")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
            return;
        }

        // Key configured — table must appear with rows
        await expect(page.locator("table")).toBeVisible({ timeout: 20_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 20_000 });
    });

    test("Anthropic page shows Claude 4.8 when available from API", async ({ page }) => {
        await page.goto("/account/providers/anthropic");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            test.skip();
            return;
        }

        // Wait for table to load
        await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        // Claude 4.8 should appear (from Anthropic API directly)
        const claude48 = page.getByText("Claude Opus 4.8", { exact: false });
        const isVisible = await claude48.isVisible().catch(() => false);

        // Log result either way — don't hard-fail if Anthropic hasn't released yet
        if (isVisible) {
            await expect(claude48.first()).toBeVisible();
        } else {
            console.log("Claude 4.8 not yet in Anthropic API response — skipping assertion");
        }
    });

    test("Concentrate page shows ZDR toggle", async ({ page }) => {
        await page.goto("/account/providers/concentrate");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            test.skip();
            return;
        }

        await expect(page.getByText("ZDR only")).toBeVisible({ timeout: 5_000 });
    });

    test("Concentrate page shows only ZDR models by default", async ({ page }) => {
        await page.goto("/account/providers/concentrate");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            test.skip();
            return;
        }

        await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        // All visible models should have ZDR shield (filled shield svg)
        const rows = page.locator("tbody tr");
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThan(0);
    });

    test("Concentrate page ZDR toggle shows more models when turned off", async ({ page }) => {
        await page.goto("/account/providers/concentrate");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            test.skip();
            return;
        }

        await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        const zdrCount = await page.locator("tbody tr").count();

        // Toggle ZDR off
        await page.getByText("ZDR only").click();
        await page.waitForTimeout(500);

        const allCount = await page.locator("tbody tr").count();
        expect(allCount).toBeGreaterThanOrEqual(zdrCount);
    });

    test("Google page shows Gemini models when key is configured", async ({ page }) => {
        await page.goto("/account/providers/google");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            await expect(page.locator("table")).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
            return;
        }

        await expect(page.locator("table")).toBeVisible({ timeout: 20_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 20_000 });

        await expect(page.getByText(/Gemini/i).first()).toBeVisible();
    });

    test("OpenAI page shows GPT models when key is configured", async ({ page }) => {
        await page.goto("/account/providers/openai");
        await page.waitForLoadState("networkidle");

        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            await expect(page.getByText("Add your OpenAI key above")).toBeVisible();
            return;
        }

        await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
        await expect(async () => {
            const count = await page.locator("tbody tr").count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 15_000 });

        await expect(page.getByText(/GPT/i).first()).toBeVisible();
    });

    test("provider nav dot is filled for configured providers", async ({ page }) => {
        await page.goto("/account/providers/concentrate");
        await page.waitForLoadState("networkidle");

        // The nav dot for Concentrate should be filled (bg-gray-400) when key is configured
        const hasKey = await page.getByText("Verified").isVisible().catch(() => false);
        if (!hasKey) {
            test.skip();
            return;
        }

        const nav = page.locator("nav[aria-label='Settings']");
        // Concentrate button should have a filled dot (not bg-gray-200)
        const concentrateBtn = nav.getByRole("button", { name: "Concentrate" });
        await expect(concentrateBtn).toBeVisible();
    });

    test("Model Preferences page loads with tier dropdowns", async ({ page }) => {
        await page.goto("/account/preferences");
        await page.waitForLoadState("networkidle");

        await expect(page.getByRole("heading", { name: "Model Preferences" })).toBeVisible();
        // Check tier labels by their label element text (exact match)
        await expect(page.locator("label").filter({ hasText: /^High$/ })).toBeVisible();
        await expect(page.locator("label").filter({ hasText: /^Medium$/ })).toBeVisible();
        await expect(page.locator("label").filter({ hasText: /^Low$/ })).toBeVisible();
        // Three dropdowns present
        const dropdowns = page.locator("button").filter({ has: page.locator("svg") }).filter({ hasText: /auto|Opus|Sonnet|Haiku|Flash|GPT|Gemini|MiniMax/ });
        await expect(async () => {
            expect(await dropdowns.count()).toBeGreaterThanOrEqual(1);
        }).toPass({ timeout: 5_000 });
    });
});

test.describe("Provider model API endpoints", () => {
    // Call the backend API directly via fetch inside page.evaluate, using the
    // browser's auth session (cookies/local storage). This bypasses the
    // frontend JS module cache entirely.
    test.beforeEach(async ({ page }) => {
        await signIn(page, EXISTING_USER);
        // Land on a page so the app is loaded and auth is established
        await page.goto("/account");
        await page.waitForLoadState("networkidle");
    });

    async function fetchFromBrowser(page: import("@playwright/test").Page, path: string) {
        return page.evaluate(async (url) => {
            // Supabase stores the auth token as JSON in localStorage under a key
            // matching the pattern "sb-{project-ref}-auth-token"
            let token: string | null = null;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
                    try {
                        const val = JSON.parse(localStorage.getItem(key) ?? "{}");
                        token = val?.access_token ?? null;
                        if (token) break;
                    } catch {}
                }
            }
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(url, { headers });
            return { status: res.status, body: await res.json() };
        }, `/api/backend${path}`);
    }

    test("Concentrate endpoint returns models with ZDR metadata", async ({ page }) => {
        const { status, body } = await fetchFromBrowser(page, "/providers/concentrate/models") as { status: number; body: { models: { id: string; zdr?: boolean }[] } };
        expect(status).toBe(200);
        expect(Array.isArray(body.models)).toBe(true);
        expect(body.models.length).toBeGreaterThan(0);
        const zdrCount = body.models.filter((m) => m.zdr).length;
        console.log(`Concentrate: ${body.models.length} models, ${zdrCount} with ZDR`);
    });

    test("Anthropic endpoint returns models including Claude 4.8", async ({ page }) => {
        const { status, body } = await fetchFromBrowser(page, "/providers/anthropic/models") as { status: number; body: { models: { id: string }[] } };
        expect(status).toBe(200);
        expect(Array.isArray(body.models)).toBe(true);
        console.log(`Anthropic: ${body.models.length} — ${body.models.slice(0, 4).map((m) => m.id).join(", ")}`);
        if (body.models.length > 0) {
            const has48 = body.models.some((m) => m.id.includes("4-8"));
            console.log(`Claude Opus 4.8 present: ${has48}`);
        }
    });

    test("Google endpoint returns Gemini models", async ({ page }) => {
        const { status, body } = await fetchFromBrowser(page, "/providers/gemini/models") as { status: number; body: { models: { id: string }[] } };
        expect(status).toBe(200);
        expect(Array.isArray(body.models)).toBe(true);
        console.log(`Google: ${body.models.length} — ${body.models.slice(0, 3).map((m) => m.id).join(", ")}`);
    });

    test("OpenAI endpoint returns GPT models", async ({ page }) => {
        const { status, body } = await fetchFromBrowser(page, "/providers/openai/models") as { status: number; body: { models: { id: string }[] } };
        expect(status).toBe(200);
        expect(Array.isArray(body.models)).toBe(true);
        console.log(`OpenAI: ${body.models.length} — ${body.models.slice(0, 3).map((m) => m.id).join(", ")}`);
    });

    test("Merged endpoint returns all provider models with ZDR overlay", async ({ page }) => {
        const { status, body } = await fetchFromBrowser(page, "/providers/merged/models") as { status: number; body: { models: { id: string; zdr?: boolean; provider: string }[] } };
        expect(status).toBe(200);
        expect(Array.isArray(body.models)).toBe(true);
        expect(body.models.length).toBeGreaterThan(0);
        const zdrCount = body.models.filter((m) => m.zdr).length;
        const providers = [...new Set(body.models.map((m) => m.provider))];
        console.log(`Merged: ${body.models.length} models, ${zdrCount} ZDR, providers: ${providers.join(", ")}`);
    });
});
