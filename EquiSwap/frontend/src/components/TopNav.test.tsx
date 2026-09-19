import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "./TopNav";
import { useAuth } from "../lib/AuthContext";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
} from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    listNotifications: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
    markNotificationRead: vi.fn(),
  };
});

const memberUser = {
  user_id: 1,
  name: "Mia",
  email: "mia@example.com",
  trust_score: 80,
  rejection_count: 0,
  role: "member",
  is_active: true,
};

const adminUser = { ...memberUser, role: "admin" };

function renderTopNav() {
  return render(
    <MemoryRouter>
      <TopNav eyebrow="EquiSwap" heading="Dashboard" />
    </MemoryRouter>,
  );
}

describe("TopNav", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows login and sign up links for guests", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderTopNav();

    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Notifications" }),
    ).not.toBeInTheDocument();
  });

  it("shows the admin link only for admin users", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listNotifications).mockResolvedValue([]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);

    renderTopNav();

    expect(
      await screen.findByRole("link", { name: "Admin" }),
    ).toBeInTheDocument();
  });

  it("does not show the admin link for members", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listNotifications).mockResolvedValue([]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);

    renderTopNav();

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Dashboard" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: "Admin" }),
    ).not.toBeInTheDocument();
  });

  it("shows the unread count badge and opens the notification panel", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listNotifications).mockResolvedValue([
      {
        n_id: 1,
        user_id: 1,
        type: "swap_proposal",
        message: "New swap request",
        is_read: false,
      },
    ]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(1);

    const user = userEvent.setup();
    renderTopNav();

    expect(await screen.findByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("New swap request")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("shows an empty state when there are no notifications", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listNotifications).mockResolvedValue([]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);

    const user = userEvent.setup();
    renderTopNav();

    await waitFor(() => expect(listNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("marks a notification as read when clicked and closes the panel", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    const notification = {
      n_id: 1,
      user_id: 1,
      type: "swap_proposal",
      message: "New swap request",
      is_read: false,
    };
    vi.mocked(listNotifications).mockResolvedValue([notification]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(1);
    vi.mocked(markNotificationRead).mockResolvedValue({
      ...notification,
      is_read: true,
    });

    const user = userEvent.setup();
    renderTopNav();

    await screen.findByText("1");
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByText("New swap request"));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(1));
    expect(screen.queryByText("New swap request")).not.toBeInTheDocument();
  });

  it("resets notifications when the request fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listNotifications).mockRejectedValue(new Error("network error"));
    vi.mocked(getUnreadNotificationCount).mockRejectedValue(
      new Error("network error"),
    );

    renderTopNav();

    await waitFor(() =>
      expect(screen.queryByText(/unread/)).not.toBeInTheDocument(),
    );
  });

  it("calls logout when the log out button is clicked", async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: memberUser,
      isLoading: false,
      login: vi.fn(),
      logout,
    });
    vi.mocked(listNotifications).mockResolvedValue([]);
    vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);

    const user = userEvent.setup();
    renderTopNav();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Log out" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(logout).toHaveBeenCalled();
  });
});
