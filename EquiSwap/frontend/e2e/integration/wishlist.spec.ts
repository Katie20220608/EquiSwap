import { expect, test } from "@playwright/test";
import {
  addToWishlist,
  createItem,
  createUser,
  openDashboardAs,
  panel,
  uniqueId,
} from "./helpers.ts";

test.describe("wishlist", () => {
  test("a user can add another user's item to their wishlist", async ({
    page,
    request,
  }) => {
    const owner = await createUser(request, "owner");
    const wisher = await createUser(request, "wisher");
    const itemName = uniqueId("Lego set");
    await createItem(request, owner, itemName);
    await openDashboardAs(page, wisher);

    const wishlist = panel(page, "wishlist-heading");
    await expect(
      wishlist.getByRole("heading", { name: "Wishlist (0)" }),
    ).toBeVisible();

    const card = page.locator("article", { hasText: itemName });
    await expect(card).toContainText(`Owner: ${owner.name}`);
    await card.getByRole("button", { name: "Add to wishlist" }).click();

    await expect(card.getByText("In wishlist")).toBeVisible();
    await expect(
      wishlist.getByRole("heading", { name: "Wishlist (1)" }),
    ).toBeVisible();
    await expect(wishlist.getByText(itemName)).toBeVisible();

    await page.reload();
    await expect(
      panel(page, "wishlist-heading").getByText(itemName),
    ).toBeVisible();
  });

  test("a user can remove an item from their wishlist", async ({
    page,
    request,
  }) => {
    const owner = await createUser(request, "owner");
    const wisher = await createUser(request, "wisher");
    const itemName = uniqueId("Teddy bear");
    const itemId = await createItem(request, owner, itemName);
    await addToWishlist(request, wisher, itemId);
    await openDashboardAs(page, wisher);

    const wishlist = panel(page, "wishlist-heading");
    await expect(wishlist.getByText(itemName)).toBeVisible();
    await wishlist.getByRole("button", { name: "Remove" }).click();

    await expect(wishlist.getByText(itemName)).toHaveCount(0);
    await expect(
      wishlist.getByRole("heading", { name: "Wishlist (0)" }),
    ).toBeVisible();
    // The item is browsable again with the add button restored.
    await expect(
      page
        .locator("article", { hasText: itemName })
        .getByRole("button", { name: "Add to wishlist" }),
    ).toBeVisible();
  });

  test("a user cannot browse their own items", async ({ page, request }) => {
    const user = await createUser(request);
    const itemName = uniqueId("Scooter");
    await createItem(request, user, itemName);
    await openDashboardAs(page, user);

    await expect(page.locator("article", { hasText: itemName })).toHaveCount(0);
  });
});
