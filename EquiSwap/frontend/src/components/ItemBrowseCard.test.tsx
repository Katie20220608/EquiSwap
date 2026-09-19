import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemBrowseCard } from "./ItemBrowseCard";
import { createWishlistEntry } from "../lib/api";
import type { ApiItem } from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    createWishlistEntry: vi.fn(),
  };
});

const item: ApiItem = {
  item_id: 1,
  owner_id: 2,
  name: "Desk lamp",
  description: "A warm reading light.",
  category_id: null,
  condition_score: 7,
  status: "available",
  image_url: null,
};

describe("ItemBrowseCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder when there is no image", () => {
    render(
      <ItemBrowseCard
        item={item}
        ownerName="Noah"
        isWishlisted={false}
        onAdded={vi.fn()}
      />,
    );

    expect(screen.getByText("No picture")).toBeInTheDocument();
    expect(screen.getByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("A warm reading light.")).toBeInTheDocument();
    expect(screen.getByText(/Owner: Noah/)).toBeInTheDocument();
  });

  it("renders the item image when an image url is present", () => {
    render(
      <ItemBrowseCard
        item={{ ...item, image_url: "https://example.com/lamp.jpg" }}
        ownerName="Noah"
        isWishlisted={false}
        onAdded={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Desk lamp" })).toHaveAttribute(
      "src",
      "https://example.com/lamp.jpg",
    );
  });

  it("shows a wishlisted badge instead of the add button", () => {
    render(
      <ItemBrowseCard
        item={item}
        ownerName="Noah"
        isWishlisted={true}
        onAdded={vi.fn()}
      />,
    );

    expect(screen.getByText("In wishlist")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add to wishlist" }),
    ).not.toBeInTheDocument();
  });

  it("adds the item to the wishlist when clicked", async () => {
    const entry = { wishlist_id: 1, user_id: 1, item_id: 1 };
    vi.mocked(createWishlistEntry).mockResolvedValue(entry);
    const onAdded = vi.fn();

    const user = userEvent.setup();
    render(
      <ItemBrowseCard
        item={item}
        ownerName="Noah"
        isWishlisted={false}
        onAdded={onAdded}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add to wishlist" }));

    expect(createWishlistEntry).toHaveBeenCalledWith(1);
    expect(onAdded).toHaveBeenCalledWith(entry);
  });

  it("shows an error message when adding to the wishlist fails", async () => {
    vi.mocked(createWishlistEntry).mockRejectedValue(
      new Error("network error"),
    );

    const user = userEvent.setup();
    render(
      <ItemBrowseCard
        item={item}
        ownerName="Noah"
        isWishlisted={false}
        onAdded={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add to wishlist" }));

    expect(
      await screen.findByText("Unable to add to wishlist. Please try again."),
    ).toBeInTheDocument();
  });
});
