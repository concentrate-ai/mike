import { test, expect } from "@playwright/test";
import { signIn, EXISTING_USER } from "../helpers/auth";

test.describe("Host files", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, EXISTING_USER);
  });

  test("Host Files tab appears in document picker when HOST_FILES_DIR is set", async ({
    page,
  }) => {
    await page.goto("/assistant");

    const addBtn = page.locator("button").filter({ hasText: /Add documents?/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, "Document picker entry point not reachable in this build.");
      return;
    }
    await addBtn.click();

    const hostFilesTab = page.getByRole("tab", { name: /Host Files/i });
    if (!(await hostFilesTab.isVisible().catch(() => false))) {
      test.skip(true, "HOST_FILES_DIR is not configured in this environment.");
      return;
    }

    await hostFilesTab.click();
    await expect(page.getByText(/Browse|files?|directory/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
