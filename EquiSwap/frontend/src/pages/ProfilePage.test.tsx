import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { useAuth } from "../lib/AuthContext";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

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
});
