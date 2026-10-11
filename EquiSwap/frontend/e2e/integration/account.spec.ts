import { expect, test } from "@playwright/test";
import { createUser, openDashboardAs, uniqueId } from "./helpers.ts";

test.describe("account management", () => {
  test("a user can add and remove a blacklist entry", async ({
    page,
    request,
  }) => {
    const user = await createUser(request, "blacklist-owner");
    const avoidedUser = await createUser(request, "blacklist-target");
    const reason = uniqueId("Pickup conflict");
    await openDashboardAs(page, user);
    await page.getByRole("link", { name: "Preferences" }).click();

    await expect(
      page.getByRole("heading", { name: "Blacklist management" }),
    ).toBeVisible();
    await expect(
      page.getByText("You haven't blacklisted anyone yet."),
    ).toBeVisible();

    await page
      .getByLabel("Find a user to avoid")
      .fill(avoidedUser.name);
    await page
      .getByLabel("Select user")
      .selectOption(String(avoidedUser.userId));
    await page.getByLabel("Reason (optional)").fill(reason);
    await page.getByRole("button", { name: "Add to blacklist" }).click();

    const blacklistEntry = page.locator(".trust-history-item", {
      hasText: avoidedUser.name,
    });
    await expect(blacklistEntry).toContainText(reason);

    await page.reload();
    const persistedEntry = page.locator(".trust-history-item", {
      hasText: avoidedUser.name,
    });
    await expect(persistedEntry).toContainText(reason);
    await persistedEntry.getByRole("button", { name: "Remove" }).click();
    await expect(
      page.getByText("You haven't blacklisted anyone yet."),
    ).toBeVisible();
  });

  test("a user can change their password and log in with the new password", async ({
    page,
    request,
  }) => {
    const user = await createUser(request, "password-change");
    const newPassword = "updated-s3cret";
    await openDashboardAs(page, user);
    await page.getByRole("link", { name: new RegExp(user.name) }).click();

    await expect(
      page.getByRole("heading", { name: `Welcome, ${user.name}.` }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Current password" })
      .fill("s3cret-pass");
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill(newPassword);
    await page
      .getByRole("textbox", { name: "Confirm new password" })
      .fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByText("Password updated successfully."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email").fill(user.email);
    await page.locator("#login-password").fill(newPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(`Welcome back, ${user.name}.`)).toBeVisible();
  });
});
