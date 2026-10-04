import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createItem,
  createSwapCycle,
  createUser,
  addToWishlist,
  openDashboardAs,
  panel,
  uniqueId,
} from "./helpers.ts";
import type { TestUser } from "./helpers.ts";

async function proposeFirstCycle(page: Page, proposer: TestUser) {
  await openDashboardAs(page, proposer);
  const matches = panel(page, "matches-heading");
  await expect(
    matches.getByRole("heading", { name: "Potential swap matches (1)" }),
  ).toBeVisible();
  await matches.getByRole("button", { name: "Propose swap" }).click();
  await expect(
    matches.getByRole("heading", { name: "Potential swap matches (0)" }),
  ).toBeVisible();
}

async function respond(
  page: Page,
  user: TestUser,
  itemName: string,
  decision: "Accept" | "Reject",
) {
  await openDashboardAs(page, user);
  const row = panel(page, "status-heading").locator("li", {
    hasText: `${itemName} · giving`,
  });
  await row.getByRole("button", { name: decision }).click();
}

test.describe("swap cycles", () => {
  test("shows a potential match once wishlists form a cycle", async ({
    page,
    request,
  }) => {
    const { users, items } = await createSwapCycle(request, 3);
    await openDashboardAs(page, users[0]);

    const matches = panel(page, "matches-heading");
    await expect(
      matches.getByRole("heading", { name: "Potential swap matches (1)" }),
    ).toBeVisible();
    for (const item of items) {
      await expect(matches.getByText(item.name)).toBeVisible();
    }
  });

  test("shows no matches when the wishlists do not form a cycle", async ({
    page,
    request,
  }) => {
    const owner = await createUser(request, "owner");
    const wisher = await createUser(request, "wisher");
    const itemId = await createItem(request, owner, uniqueId("Kite"));
    await addToWishlist(request, wisher, itemId);
    await openDashboardAs(page, wisher);

    const matches = panel(page, "matches-heading");
    await expect(
      matches.getByRole("heading", { name: "Potential swap matches (0)" }),
    ).toBeVisible();
    await expect(matches.getByText("No swap cycles found yet.")).toBeVisible();
  });

  test("proposing a swap creates pending proposals for the proposer", async ({
    page,
    request,
  }) => {
    const { users, items } = await createSwapCycle(request, 3);
    await proposeFirstCycle(page, users[0]);
    await page.reload();

    const status = panel(page, "status-heading");
    await expect(
      status.getByRole("heading", { name: "Swap status (2)" }),
    ).toBeVisible();
    // users[0] gives items[0] and receives items[1].
    await expect(
      status.locator("li", { hasText: `${items[0].name} · giving` }),
    ).toContainText("pending");
    await expect(
      status.locator("li", { hasText: "· receiving" }),
    ).toContainText("pending");
  });

  test("a full cycle is accepted by every participant and the items change hands", async ({
    page,
    request,
  }) => {
    const { users, items } = await createSwapCycle(request, 3);
    await proposeFirstCycle(page, users[0]);

    await respond(page, users[0], items[0].name, "Accept");
    await expect(
      panel(page, "status-heading").locator("li", {
        hasText: `${items[0].name} · giving`,
      }),
    ).toContainText("accepted");

    await respond(page, users[1], items[1].name, "Accept");
    await respond(page, users[2], items[2].name, "Accept");

    await openDashboardAs(page, users[0]);
    const history = panel(page, "history-heading");
    await expect(
      history.getByRole("heading", { name: "Swap history (2)" }),
    ).toBeVisible();
    await expect(history.getByText(items[1].name)).toBeVisible();
    await expect(history.getByText(/Gave to/)).toBeVisible();
    await expect(history.getByText(/Received from/)).toBeVisible();

    const myItems = panel(page, "my-items-heading");
    // items[0] moved to the next owner; users[0] now holds items[1].
    await expect(myItems.getByText(items[0].name)).toHaveCount(0);
    await myItems
      .getByRole("button", { name: /My swapped items \(1\)/ })
      .click();
    await expect(myItems.getByText(items[1].name)).toBeVisible();
  });

  test("rejecting a proposal is reflected in the status list", async ({
    page,
    request,
  }) => {
    const { users, items } = await createSwapCycle(request, 3);
    await proposeFirstCycle(page, users[0]);

    await respond(page, users[1], items[1].name, "Reject");

    const row = panel(page, "status-heading").locator("li", {
      hasText: `${items[1].name} · giving`,
    });
    await expect(row).toContainText("rejected");
    await expect(row.getByRole("button", { name: "Accept" })).toHaveCount(0);
  });

  test("participants can message the swap group after accepting", async ({
    page,
    request,
  }) => {
    const { users, items } = await createSwapCycle(request, 3);
    await proposeFirstCycle(page, users[0]);

    await respond(page, users[0], items[0].name, "Accept");

    const chat = page.getByLabel("Swap group messages");
    await expect(chat).toBeVisible();
    const message = uniqueId("Meet at the library");
    await chat.getByRole("textbox", { name: "Message" }).fill(message);
    await chat.getByRole("button", { name: "Send message" }).click();
    await expect(chat.getByText(message)).toBeVisible();
    await expect(chat.getByText(users[0].name)).toBeVisible();

    await chat.getByRole("button", { name: "Close swap messages" }).click();
    await expect(chat).toHaveCount(0);
  });
});
