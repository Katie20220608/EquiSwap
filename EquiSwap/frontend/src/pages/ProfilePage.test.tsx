import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { useAuth } from "../lib/AuthContext";
import { changePassword, getUserTrustScore } from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    changePassword: vi.fn(),
    getUserTrustScore: vi.fn(() =>
      Promise.resolve({
        user_id: 1,
        trust_score: 80,
        rejection_count: 0,
        history: [],
      }),
    ),
  };
});

const mockUser = {
  user_id: 1,
  name: "Mia",
  email: "mia@example.com",
  trust_score: 80,
  rejection_count: 2,
  role: "member",
  is_active: true,
};

function renderProfilePage() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProfilePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the user is being fetched", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProfilePage();

    expect(screen.getByText("Loading your profile...")).toBeInTheDocument();
  });

  it("redirects to login when there is no user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProfilePage();

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders the user's profile details", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderProfilePage();

    expect(screen.getByText("Welcome, Mia.")).toBeInTheDocument();
    expect(screen.getByText("mia@example.com")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("logs the user out when the log out button is clicked", async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout,
    });

    const user = userEvent.setup();
    renderProfilePage();

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(logout).toHaveBeenCalled();
  });

  it("shows an error when the trust score history fails to load", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getUserTrustScore).mockRejectedValue(new Error("network error"));

    renderProfilePage();

    expect(
      await screen.findByText("Unable to load your trust score history."),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is no trust score history", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getUserTrustScore).mockResolvedValue({
      user_id: 1,
      trust_score: 80,
      rejection_count: 0,
      history: [],
    });

    renderProfilePage();

    expect(
      await screen.findByText("No trust score changes yet."),
    ).toBeInTheDocument();
  });

  it("renders trust score history entries", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getUserTrustScore).mockResolvedValue({
      user_id: 1,
      trust_score: 80,
      rejection_count: 0,
      history: [
        {
          tl_id: 1,
          user_id: 1,
          action: "swap_completed",
          score_change: 5,
          logged_at: "2026-08-20T10:30:00Z",
          description: "Completed a swap",
        },
        {
          tl_id: 2,
          user_id: 1,
          action: "swap_rejected",
          score_change: -2,
          logged_at: null,
          description: null,
        },
      ],
    });

    renderProfilePage();

    expect(await screen.findByText("+5")).toBeInTheDocument();
    expect(screen.getByText("swap completed")).toBeInTheDocument();
    expect(screen.getByText("Completed a swap")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
  });

  it("toggles password field visibility", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderProfilePage();

    const currentPasswordInput = screen.getByLabelText("Current password");
    expect(currentPasswordInput).toHaveAttribute("type", "password");

    await user.click(
      screen.getByRole("button", { name: "Show current password" }),
    );

    expect(currentPasswordInput).toHaveAttribute("type", "text");
  });

  it("shows an error when new password and confirmation do not match", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderProfilePage();

    await user.type(screen.getByLabelText("Current password"), "old-pass");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "different-password",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("New password and confirmation must match."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("submits a password change and shows a success message", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(changePassword).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderProfilePage();

    await user.type(screen.getByLabelText("Current password"), "old-pass");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-password",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old-pass",
        newPassword: "new-password",
      }),
    );
    expect(
      await screen.findByText("Password updated successfully."),
    ).toBeInTheDocument();
  });

  it("shows an error when the password update request fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(changePassword).mockRejectedValue(new Error("network error"));

    const user = userEvent.setup();
    renderProfilePage();

    await user.type(screen.getByLabelText("Current password"), "old-pass");
    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-password",
    );
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Unable to update your password."),
    ).toBeInTheDocument();
  });
});
