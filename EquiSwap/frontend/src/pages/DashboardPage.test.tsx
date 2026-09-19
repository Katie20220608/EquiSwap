import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { useAuth } from "../lib/AuthContext";
import {
  createItem,
  createWishlistEntry,
  deleteItem,
  deleteWishlistEntry,
  findSwapCycles,
  listItems,
  listMySwapHistory,
  listMySwapProposals,
  listMyWishlist,
  listUsers,
  proposeSwap,
  respondToSwapProposal,
  updateItem,
} from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    listItems: vi.fn(),
    listMyWishlist: vi.fn(),
    listMySwapProposals: vi.fn(),
    listMySwapHistory: vi.fn(() => Promise.resolve([])),
    listUsers: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    createWishlistEntry: vi.fn(),
    deleteItem: vi.fn(),
    deleteWishlistEntry: vi.fn(),
    respondToSwapProposal: vi.fn(),
    findSwapCycles: vi.fn(() => Promise.resolve({ user_id: 0, cycles: [] })),
    proposeSwap: vi.fn(),
  };
});

const mockUser = {
  user_id: 1,
  name: "Mia",
  email: "mia@example.com",
  trust_score: 80,
  rejection_count: 0,
  role: "member",
  is_active: true,
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(listMySwapHistory).mockResolvedValue([]);
  });

  it("redirects to login when there is no authenticated user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderDashboard();

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders my items, wishlist, and swap status once loaded", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([
      {
        item_id: 1,
        owner_id: 1,
        name: "Ceramic pour-over set",
        description: null,
        category_id: null,
        condition_score: 7,
        status: "available",
        image_url: null,
      },
      {
        item_id: 2,
        owner_id: 2,
        name: "Desk lamp",
        description: null,
        category_id: null,
        condition_score: 5,
        status: "available",
        image_url: null,
      },
    ]);
    vi.mocked(listMyWishlist).mockResolvedValue([
      { wishlist_id: 10, user_id: 1, item_id: 2 },
    ]);
    vi.mocked(listMySwapProposals).mockResolvedValue([
      {
        sp_id: 100,
        cycle_id: "cycle-1",
        giver_id: 1,
        receiver_id: 2,
        item_id: 1,
        status: "pending",
        expires_at: null,
      },
    ]);
    vi.mocked(listUsers).mockResolvedValue([]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("My items (1)")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Ceramic pour-over set")).toHaveLength(2);
    expect(screen.getByText("Wishlist (1)")).toBeInTheDocument();
    expect(screen.getAllByText("Desk lamp")).toHaveLength(2);
    expect(screen.getByText("Swap status (1)")).toBeInTheDocument();
    expect(screen.getByText(/giving/)).toBeInTheDocument();
  });

  it("shows accept/reject actions only for pending proposals where the user is the giver", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([
      {
        sp_id: 100,
        cycle_id: "cycle-1",
        giver_id: 1,
        receiver_id: 2,
        item_id: 1,
        status: "pending",
        expires_at: null,
      },
      {
        sp_id: 101,
        cycle_id: "cycle-2",
        giver_id: 2,
        receiver_id: 1,
        item_id: 2,
        status: "pending",
        expires_at: null,
      },
    ]);
    vi.mocked(listUsers).mockResolvedValue([]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Swap status (2)")).toBeInTheDocument(),
    );

    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(1);
  });

  it("renders completed swap details in the history section", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([
      {
        item_id: 1,
        owner_id: 2,
        name: "Ceramic pour-over set",
        description: "Handmade dripper with two cups.",
        category_id: null,
        condition_score: 7,
        status: "swapped",
        image_url: null,
      },
    ]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listMySwapHistory).mockResolvedValue([
      {
        sh_id: 5,
        item_id: 1,
        from_user_id: 1,
        to_user_id: 2,
        cycle_id: "cycle-1",
        swap_date: "2026-08-20T10:30:00Z",
        notes: "Exchange completed at the campus library.",
      },
    ]);
    vi.mocked(listUsers).mockResolvedValue([
      { ...mockUser },
      {
        ...mockUser,
        user_id: 2,
        name: "Noah",
        email: "noah@example.com",
      },
    ]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Swap history (1)")).toBeInTheDocument(),
    );
    expect(screen.getByText("Ceramic pour-over set")).toBeInTheDocument();
    expect(screen.getByText("Gave to Noah")).toBeInTheDocument();
    expect(
      screen.getByText("Handmade dripper with two cups."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Exchange completed at the campus library."),
    ).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute(
      "dateTime",
      "2026-08-20T10:30:00Z",
    );
  });

  it("accepts a swap proposal and updates its status", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    const pendingProposal = {
      sp_id: 100,
      cycle_id: "cycle-1",
      giver_id: 1,
      receiver_id: 2,
      item_id: 1,
      status: "pending",
      expires_at: null,
    };
    vi.mocked(listMySwapProposals).mockResolvedValue([pendingProposal]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(respondToSwapProposal).mockResolvedValue({
      ...pendingProposal,
      status: "accepted",
    });

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Swap status (1)")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(respondToSwapProposal).toHaveBeenCalledWith(100, "accepted"),
    );
    expect(await screen.findByText("accepted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();
  });

  it("rejects a swap proposal and shows an error if the request fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    const pendingProposal = {
      sp_id: 100,
      cycle_id: "cycle-1",
      giver_id: 1,
      receiver_id: 2,
      item_id: 1,
      status: "pending",
      expires_at: null,
    };
    vi.mocked(listMySwapProposals).mockResolvedValue([pendingProposal]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(respondToSwapProposal).mockRejectedValue(
      new Error("network error"),
    );

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Swap status (1)")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(
      await screen.findByText(
        "Unable to record your response. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("lists potential swap cycles and proposes a swap", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([
      { ...mockUser, user_id: 1, name: "Mia" },
      { ...mockUser, user_id: 2, name: "Jordan" },
    ]);
    vi.mocked(findSwapCycles).mockResolvedValue({
      user_id: 1,
      cycles: [[1, 2]],
    });
    const createdProposal = {
      sp_id: 200,
      cycle_id: "cycle-3",
      giver_id: 1,
      receiver_id: 2,
      item_id: 5,
      status: "pending",
      expires_at: null,
    };
    vi.mocked(proposeSwap).mockResolvedValue([createdProposal]);

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(
        screen.getByText("Potential swap matches (1)"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Jordan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Propose swap" }));

    await waitFor(() => expect(proposeSwap).toHaveBeenCalledWith([1, 2]));
    expect(
      await screen.findByText("Potential swap matches (0)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Swap status (1)")).toBeInTheDocument();
  });

  it("shows an error message when the dashboard fails to load", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockRejectedValue(new Error("network error"));
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);

    renderDashboard();

    expect(
      await screen.findByText(
        "Unable to load your dashboard. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("adds a new item through the add item form", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(createItem).mockResolvedValue({
      item_id: 3,
      owner_id: 1,
      name: "Ceramic mug",
      description: null,
      category_id: null,
      condition_score: 5,
      status: "available",
      image_url: null,
    });

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("My items (0)")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "+ Add item" }));
    await user.type(screen.getByLabelText("Name"), "Ceramic mug");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(createItem).toHaveBeenCalled());
    expect(await screen.findByText("My items (1)")).toBeInTheDocument();
    expect(screen.getByText("Ceramic mug")).toBeInTheDocument();
  });

  it("edits an existing item through the inline edit form", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const item = {
      item_id: 1,
      owner_id: 1,
      name: "Desk lamp",
      description: null,
      category_id: null,
      condition_score: 5,
      status: "available",
      image_url: null,
    };
    vi.mocked(listItems).mockResolvedValue([item]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(updateItem).mockResolvedValue({ ...item, name: "Brass lamp" });

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Desk lamp")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Brass lamp");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith(1, expect.anything()),
    );
    expect(await screen.findByText("Brass lamp")).toBeInTheDocument();
  });

  it("deletes an owned item after the request succeeds", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([
      {
        item_id: 1,
        owner_id: 1,
        name: "Desk lamp",
        description: null,
        category_id: null,
        condition_score: 5,
        status: "available",
        image_url: null,
      },
    ]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(deleteItem).mockResolvedValue();

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("My items (1)");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith(1));
    expect(await screen.findByText("My items (0)")).toBeInTheDocument();
    expect(screen.queryByText("Desk lamp")).not.toBeInTheDocument();
  });

  it("adds an item to the wishlist", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const wishableItem = {
      item_id: 2,
      owner_id: 2,
      name: "Desk lamp",
      description: null,
      category_id: null,
      condition_score: 5,
      status: "available",
      image_url: null,
    };
    vi.mocked(listItems).mockResolvedValue([wishableItem]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(createWishlistEntry).mockResolvedValue({
      wishlist_id: 9,
      user_id: 1,
      item_id: 2,
    });

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Wishlist (0)")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Add to wishlist" }));

    await waitFor(() => expect(createWishlistEntry).toHaveBeenCalledWith(2));
    expect(await screen.findByText("Wishlist (1)")).toBeInTheDocument();
  });

  it("removes a wishlist entry after the request succeeds", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listItems).mockResolvedValue([
      {
        item_id: 2,
        owner_id: 2,
        name: "Desk lamp",
        description: null,
        category_id: null,
        condition_score: 5,
        status: "available",
        image_url: null,
      },
    ]);
    vi.mocked(listMyWishlist).mockResolvedValue([
      { wishlist_id: 9, user_id: 1, item_id: 2 },
    ]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);
    vi.mocked(deleteWishlistEntry).mockResolvedValue();

    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Wishlist (1)");
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deleteWishlistEntry).toHaveBeenCalledWith(9));
    expect(await screen.findByText("Wishlist (0)")).toBeInTheDocument();
  });

  it("excludes already-swapped items from the wishlist options", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const swappedItem = {
      item_id: 2,
      owner_id: 2,
      name: "Ukulele",
      description: null,
      category_id: null,
      condition_score: 5,
      status: "swapped",
      image_url: null,
    };
    vi.mocked(listItems).mockResolvedValue([swappedItem]);
    vi.mocked(listMyWishlist).mockResolvedValue([]);
    vi.mocked(listMySwapProposals).mockResolvedValue([]);
    vi.mocked(listUsers).mockResolvedValue([]);

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("Wishlist (0)")).toBeInTheDocument(),
    );

    expect(
      screen.getByText(
        "There are no other available items to browse right now.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add to wishlist" }),
    ).not.toBeInTheDocument();
  });
});
