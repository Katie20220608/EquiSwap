import { expect, test } from "@playwright/test";

const API = "http://localhost:8000";

test.describe("landing page", () => {
  test("shows hero and navigates to login", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero-heading")).toBeVisible();
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
  });
});

test.describe("login", () => {
  test("shows validation errors for empty and invalid input", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    await page.goto("/login");
    const password = page.locator("#login-password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  test("shows the server error on bad credentials", async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Incorrect email or password" }),
      }),
    );
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.locator("#login-password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Incorrect email or password",
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test("redirects to the dashboard on success", async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({
        json: { access_token: "test-token", token_type: "bearer" },
      }),
    );
    await page.route(`${API}/auth/me`, (route) =>
      route.fulfill({
        json: {
          user_id: 1,
          name: "Test User",
          email: "user@example.com",
          trust_score: 5,
          rejection_count: 0,
          role: "user",
          is_active: true,
        },
      }),
    );
    // Any other API call made by the dashboard gets an empty list.
    await page.route(
      (url) => url.origin === API && !url.pathname.startsWith("/auth/"),
      (route) => route.fulfill({ json: [] }),
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.locator("#login-password").fill("correct-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("register", () => {
  test("is reachable from the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});
