import { expect, test } from "@playwright/test";

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    // The picker is populated from /api/models, which now discovers models from
    // whichever providers are configured. Wait for that before interacting, or
    // the list is still settling under the first click.
    const catalogue = page.waitForResponse(
      (response) => response.url().includes("/api/models") && response.ok()
    );
    await page.goto("/");
    await catalogue;
  });

  test("displays a model button", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await expect(modelButton).toBeVisible();
  });

  test("opens model selector popover on click", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  });

  test("can search for models", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    const searchInput = page.getByPlaceholder("Search models...");
    await searchInput.fill("DeepSeek");

    await expect(
      page.getByRole("option", { name: /DeepSeek V3\.2/ })
    ).toBeVisible();
  });

  test("can close model selector by clicking outside", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await expect(page.getByPlaceholder("Search models...")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
  });

  test("groups models by provider", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    const availableModels = page.getByRole("group", {
      name: "Vercel AI Gateway",
    });
    await expect(availableModels).toBeVisible();
    await expect(
      availableModels.getByRole("option", { name: /DeepSeek V3\.2/ })
    ).toBeVisible();
    await expect(
      availableModels.getByRole("option", { name: /Kimi K2\.5/ })
    ).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    const modelButton = page.getByTestId("model-selector");
    await modelButton.click();

    await page.getByRole("option", { name: /DeepSeek V3\.2/ }).click();

    await expect(page.getByPlaceholder("Search models...")).not.toBeVisible();
    await expect(modelButton).toContainText("DeepSeek V3.2");
  });
});
