import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as api from "./api";

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof api>("./api");
  return {
    ...actual,
    fetchCurrentUser: vi.fn(),
    loginUser: vi.fn(),
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

function Consumer() {
  const { user, isLoading, logout } = useAuth();
  if (isLoading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `Hello ${user.name}` : "No user"}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("has no user when there is no stored token", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("No user")).toBeInTheDocument(),
    );
    expect(api.fetchCurrentUser).not.toHaveBeenCalled();
  });

  it("loads the current user when a token is present", async () => {
    api.setToken("token-xyz");
    vi.mocked(api.fetchCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Hello Mia")).toBeInTheDocument(),
    );
  });

  it("clears the token and user when fetching the current user fails", async () => {
    api.setToken("stale-token");
    vi.mocked(api.fetchCurrentUser).mockRejectedValue(new Error("expired"));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("No user")).toBeInTheDocument(),
    );
    expect(api.getToken()).toBeNull();
  });

  it("logs out and clears the current user", async () => {
    api.setToken("token-xyz");
    vi.mocked(api.fetchCurrentUser).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Hello Mia")).toBeInTheDocument(),
    );

    await act(async () => {
      screen.getByRole("button", { name: "Log out" }).click();
    });

    expect(screen.getByText("No user")).toBeInTheDocument();
    expect(api.getToken()).toBeNull();
  });
});
