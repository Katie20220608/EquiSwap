import { expect, test } from "@playwright/test";

test("a new user can register, log in, and reach the dashboard", async ({
  page,
}) => {
  const name = "E2E Parent";
  const email = `e2e-${Date.now()}@example.com`;
  const password = "s3cret-pass";

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm-password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Welcome back, ${name}.`)).toBeVisible();
  await expect(page.locator("#my-items-heading")).toBeVisible();
});

test("login is rejected for wrong credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.locator("#login-password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("duplicate registration shows an error", async ({ page }) => {
  const email = `dup-${Date.now()}@example.com`;
  for (const attempt of [1, 2]) {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Dup User");
    await page.getByLabel("Email").fill(email);
    await page.locator("#register-password").fill("s3cret-pass");
    await page.locator("#register-confirm-password").fill("s3cret-pass");
    await page.getByRole("button", { name: "Create account" }).click();
    if (attempt === 1) await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
