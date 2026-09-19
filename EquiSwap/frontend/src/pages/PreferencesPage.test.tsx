import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreferencesPage } from "./PreferencesPage";
import { useAuth } from "../lib/AuthContext";
import {
  createPreference,
  deletePreference,
  listMyPreferences,
  listUserDirectory,
} from "../lib/api";

vi.mock("../lib/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    listMyPreferences: vi.fn(),
    listUserDirectory: vi.fn(),
    createPreference: vi.fn(),
    deletePreference: vi.fn(),
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

function renderPreferences() {
  return render(
    <MemoryRouter initialEntries={["/preferences"]}>
      <Routes>
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PreferencesPage", () => {
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

    renderPreferences();

    expect(screen.getByText("Loading your preferences...")).toBeInTheDocument();
  });

  it("redirects to login when there is no user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderPreferences();

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("shows an error message when loading the blacklist fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockRejectedValue(new Error("network error"));
    vi.mocked(listUserDirectory).mockResolvedValue([]);

    renderPreferences();

    expect(
      await screen.findByText("Unable to load your blacklist."),
    ).toBeInTheDocument();
  });

  it("shows an empty state when nothing is blacklisted", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([]);
    vi.mocked(listUserDirectory).mockResolvedValue([
      { user_id: 2, name: "Noah" },
    ]);

    renderPreferences();

    expect(
      await screen.findByText("You haven't blacklisted anyone yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Noah")).toBeInTheDocument();
  });

  it("shows the form validation error when no user is chosen", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([]);
    vi.mocked(listUserDirectory).mockResolvedValue([]);

    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() =>
      expect(
        screen.getByText("You haven't blacklisted anyone yet."),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Add to blacklist" }));

    expect(
      await screen.findByText("Choose a user to add to your blacklist."),
    ).toBeInTheDocument();
  });

  it("adds a user to the blacklist and excludes them from the directory list", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([]);
    vi.mocked(listUserDirectory).mockResolvedValue([
      { user_id: 2, name: "Noah" },
    ]);
    vi.mocked(createPreference).mockResolvedValue({
      uf_id: 5,
      user_id: 1,
      avoid_user_id: 2,
      avoid_user_name: "Noah",
      reason: "Missed a swap",
      created_at: null,
    });

    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByText("Noah")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("User to avoid"), "2");
    await user.type(
      screen.getByLabelText("Reason (optional)"),
      "Missed a swap",
    );
    await user.click(screen.getByRole("button", { name: "Add to blacklist" }));

    await waitFor(() =>
      expect(createPreference).toHaveBeenCalledWith(2, "Missed a swap"),
    );
    expect(await screen.findByText("Missed a swap")).toBeInTheDocument();
  });

  it("shows an error when adding to the blacklist fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([]);
    vi.mocked(listUserDirectory).mockResolvedValue([
      { user_id: 2, name: "Noah" },
    ]);
    vi.mocked(createPreference).mockRejectedValue(new Error("network error"));

    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByText("Noah")).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("User to avoid"), "2");
    await user.click(screen.getByRole("button", { name: "Add to blacklist" }));

    expect(
      await screen.findByText("Unable to add this user to your blacklist."),
    ).toBeInTheDocument();
  });

  it("removes a blacklisted user", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([
      {
        uf_id: 5,
        user_id: 1,
        avoid_user_id: 2,
        avoid_user_name: "Noah",
        reason: null,
        created_at: null,
      },
    ]);
    vi.mocked(listUserDirectory).mockResolvedValue([
      { user_id: 2, name: "Noah" },
    ]);
    vi.mocked(deletePreference).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByText("Noah")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deletePreference).toHaveBeenCalledWith(5));
    expect(
      await screen.findByText("You haven't blacklisted anyone yet."),
    ).toBeInTheDocument();
  });

  it("shows an error when removing a blacklisted user fails", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(listMyPreferences).mockResolvedValue([
      {
        uf_id: 5,
        user_id: 1,
        avoid_user_id: 2,
        avoid_user_name: "Noah",
        reason: null,
        created_at: null,
      },
    ]);
    vi.mocked(listUserDirectory).mockResolvedValue([]);
    vi.mocked(deletePreference).mockRejectedValue(new Error("network error"));

    const user = userEvent.setup();
    renderPreferences();

    await waitFor(() => expect(screen.getByText("Noah")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText(
        "Unable to remove this user from your blacklist.",
      ),
    ).toBeInTheDocument();
  });
});
