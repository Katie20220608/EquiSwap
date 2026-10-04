import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./AdminDashboardPage";
import { useAuth } from "../lib/AuthContext";
import {
  getAdminStats,
  getAdminSwapInsights,
  getAdminUserDetail,
  listAdminUsers,
  setAdminUserStatus,
} from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    listAdminUsers: vi.fn(),
    getAdminStats: vi.fn(),
    getAdminSwapInsights: vi.fn(),
    getAdminUserDetail: vi.fn(),
    setAdminUserStatus: vi.fn(),
  };
});

const adminUser = {
  user_id: 1,
  name: "Admin",
  email: "admin@example.com",
  trust_score: 100,
  rejection_count: 0,
  role: "admin",
  is_active: true,
};

const statsFixture = {
  total_users: 7,
  new_users_7d: 2,
  total_items: 12,
  available_items: 9,
  open_swaps: 1,
  completed_swaps: 3,
  proposal_status_counts: { pending: 1, accepted: 3 },
  signups_per_day: [{ day: "2026-10-04", count: 2 }],
  swaps_per_day: [{ day: "2026-10-04", count: 1 }],
  top_categories: [{ category: "Toys", items: 4, wishlists: 2 }],
};

const insightsFixture = {
  total_cycles: 4,
  completed_cycles: 2,
  success_rate: 0.5,
  average_cycle_length: 2.5,
  average_hours_to_complete: 12.5,
  outcome_counts: { completed: 2, rejected: 2 },
  by_length: [{ length: 2, total: 4, completed: 2, success_rate: 0.5 }],
  top_rejection_reasons: [{ reason: "Too far", count: 2 }],
  stale_pending_cycles: 1,
};

const memberUser = { ...adminUser, user_id: 2, role: "member" };

function renderAdminDashboard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/dashboard" element={<p>dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(getAdminStats).mockResolvedValue(statsFixture);
    vi.mocked(getAdminSwapInsights).mockResolvedValue(insightsFixture);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while auth is resolving", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminDashboard();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to login when there is no user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminDashboard();

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("redirects to the dashboard when the user is not an admin", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminDashboard();

    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("shows an error message when loading users fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listAdminUsers).mockRejectedValue(new Error("network error"));

    renderAdminDashboard();

    expect(
      await screen.findByText(
        "Unable to load admin dashboard. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no users", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listAdminUsers).mockResolvedValue([]);
    vi.mocked(getAdminStats).mockResolvedValue(statsFixture);

    renderAdminDashboard();

    expect(await screen.findByText("No users found.")).toBeInTheDocument();
  });

  it("renders the list of users and their posted items", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getAdminStats).mockResolvedValue(statsFixture);
    vi.mocked(listAdminUsers).mockResolvedValue([
      {
        ...memberUser,
        name: "Noah",
        email: "noah@example.com",
        items: [
          {
            item_id: 1,
            owner_id: 2,
            name: "Desk lamp",
            description: null,
            category_id: null,
            condition_score: 7,
            status: "available",
            image_url: null,
          },
        ],
      },
      {
        ...memberUser,
        user_id: 3,
        name: "Ivy",
        email: "ivy@example.com",
        is_active: false,
        items: [],
      },
    ]);

    renderAdminDashboard();

    await waitFor(() =>
      expect(screen.getByText("All users")).toBeInTheDocument(),
    );
    expect(screen.getByText("Platform overview")).toBeInTheDocument();
    expect(screen.getByText("Completed swaps")).toBeInTheDocument();
    expect(screen.getByText("Toys")).toBeInTheDocument();
    expect(screen.getByText("Noah")).toBeInTheDocument();
    expect(screen.getByText("noah@example.com")).toBeInTheDocument();
    expect(screen.getByText("Posted items (1)")).toBeInTheDocument();
    expect(screen.getByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();

    expect(screen.getByText("Ivy")).toBeInTheDocument();
    expect(
      screen.getByText("Suspended", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Posted items (0)")).toBeInTheDocument();
    expect(screen.getByText("No items posted.")).toBeInTheDocument();
  });

  it("shows swap-cycle insights", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listAdminUsers).mockResolvedValue([]);

    renderAdminDashboard();

    expect(await screen.findByText("Swap-cycle insights")).toBeInTheDocument();
    expect(screen.getByText("Too far")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
  });

  it("searches users with the typed query", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listAdminUsers).mockResolvedValue([]);

    renderAdminDashboard();
    fireEvent.change(await screen.findByLabelText("Search users"), {
      target: { value: "noah" },
    });
    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "suspended" },
    });

    await waitFor(() =>
      expect(listAdminUsers).toHaveBeenLastCalledWith({
        q: "noah",
        role: undefined,
        status: "suspended",
      }),
    );
  });

  it("suspends a user and opens their detail view", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const noah = {
      ...memberUser,
      name: "Noah",
      email: "noah@example.com",
      items: [],
    };
    vi.mocked(listAdminUsers).mockResolvedValue([noah]);
    vi.mocked(setAdminUserStatus).mockResolvedValue({
      ...memberUser,
      is_active: false,
    });
    vi.mocked(getAdminUserDetail).mockResolvedValue({
      user: memberUser,
      items: [],
      swap_counts: { given: 1, received: 2, completed: 3, rejected: 0 },
      wishlist_count: 4,
      recent_trust_logs: [
        {
          tl_id: 1,
          user_id: 2,
          action: "x",
          score_change: -5,
          logged_at: null,
          description: "Rejected cycle",
        },
      ],
    });

    renderAdminDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    expect(
      await screen.findByText("Suspended", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(setAdminUserStatus).toHaveBeenCalledWith(2, false);
    expect(
      screen.getByRole("button", { name: "Reactivate" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(await screen.findByText("Rejected cycle")).toBeInTheDocument();
    expect(screen.getByText("Proposals received")).toBeInTheDocument();
  });
});
