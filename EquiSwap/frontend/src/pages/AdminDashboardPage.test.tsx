import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./AdminDashboardPage";
import { useAuth } from "../lib/AuthContext";
import { listAdminUsers } from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    listAdminUsers: vi.fn(),
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
    expect(screen.getByText("Noah")).toBeInTheDocument();
    expect(screen.getByText("noah@example.com")).toBeInTheDocument();
    expect(screen.getByText("Posted items (1)")).toBeInTheDocument();
    expect(screen.getByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();

    expect(screen.getByText("Ivy")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Posted items (0)")).toBeInTheDocument();
    expect(screen.getByText("No items posted.")).toBeInTheDocument();
  });
});
