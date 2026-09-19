import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors and does not call login for invalid input", async () => {
    const login = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      login,
      logout: vi.fn(),
      user: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the profile page on success", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      login,
      logout: vi.fn(),
      user: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "mia@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("mia@example.com", "password1"),
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/profile"));
  });

  it("shows and hides the password on request", async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderLoginPage();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows the server error message when login fails", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError("Incorrect email or password", 401));
    vi.mocked(useAuth).mockReturnValue({
      login,
      logout: vi.fn(),
      user: null,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "mia@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByText("Incorrect email or password"),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
