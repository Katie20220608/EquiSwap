import { expect, test } from "@playwright/test";
import {
  createItem,
  createUser,
  openDashboardAs,
  panel,
  uniqueId,
} from "./helpers.ts";

test.describe("my items", () => {
  test("a user can add an item", async ({ page, request }) => {
    const user = await createUser(request);
    const itemName = uniqueId("Wooden train");
    await openDashboardAs(page, user);

    const myItems = panel(page, "my-items-heading");
    await expect(
      myItems.getByText("You haven't listed any items yet."),
    ).toBeVisible();

    await myItems.getByRole("button", { name: "+ Add item" }).click();
    await myItems.getByLabel("Name").fill(itemName);
    await myItems.getByLabel("Description").fill("Barely used");
    await myItems.getByLabel("Condition (1-10)").fill("8");
    await myItems.getByRole("button", { name: "Add item" }).click();

    await expect(
      myItems.getByRole("heading", { name: "My items (1)" }),
    ).toBeVisible();
    await expect(myItems.getByText(itemName)).toBeVisible();

    // The item survives a reload, so it was really persisted by the API.
    await page.reload();
    await expect(
      panel(page, "my-items-heading").getByText(itemName),
    ).toBeVisible();
  });

  test("adding an item without a name shows an error", async ({
    page,
    request,
  }) => {
    const user = await createUser(request);
    await openDashboardAs(page, user);

    const myItems = panel(page, "my-items-heading");
    await myItems.getByRole("button", { name: "+ Add item" }).click();
    await myItems.getByRole("button", { name: "Add item" }).click();
    await expect(myItems.getByRole("alert")).toHaveText(
      "Item name is required.",
    );
  });

  test("a user can edit an item", async ({ page, request }) => {
    const user = await createUser(request);
    const original = uniqueId("Puzzle");
    const renamed = uniqueId("Jigsaw");
    await createItem(request, user, original);
    await openDashboardAs(page, user);

    const myItems = panel(page, "my-items-heading");
    await myItems.getByRole("button", { name: "Edit" }).click();
    await myItems.getByLabel("Name").fill(renamed);
    await myItems.getByRole("button", { name: "Save changes" }).click();

    await expect(myItems.getByText(renamed)).toBeVisible();
    await expect(myItems.getByText(original)).toHaveCount(0);

    await page.reload();
    await expect(
      panel(page, "my-items-heading").getByText(renamed),
    ).toBeVisible();
  });

  test("a user can delete an item", async ({ page, request }) => {
    const user = await createUser(request);
    const itemName = uniqueId("Old book");
    await createItem(request, user, itemName);
    await openDashboardAs(page, user);

    const myItems = panel(page, "my-items-heading");
    await expect(myItems.getByText(itemName)).toBeVisible();
    await myItems.getByRole("button", { name: "Delete" }).click();

    await expect(myItems.getByText(itemName)).toHaveCount(0);
    await expect(
      myItems.getByRole("heading", { name: "My items (0)" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      panel(page, "my-items-heading").getByText(itemName),
    ).toHaveCount(0);
  });

  test("a user's items are not shown to other users as their own", async ({
    page,
    request,
  }) => {
    const owner = await createUser(request, "owner");
    const other = await createUser(request, "other");
    const itemName = uniqueId("Doll house");
    await createItem(request, owner, itemName);
    await openDashboardAs(page, other);

    await expect(
      panel(page, "my-items-heading").getByText(itemName),
    ).toHaveCount(0);
    await expect(
      panel(page, "browse-heading").getByText(itemName),
    ).toBeVisible();
  });
});
