import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";
import { ApiError } from "../lib/api";

const navigateMock = vi.fn();
const registerUserMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    registerUser: (...args: unknown[]) => registerUserMock(...args),
  };
});

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors for empty and mismatched fields", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Password"), "password1");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("registers the user and navigates to login on success", async () => {
    registerUserMock.mockResolvedValue({
      user_id: 1,
      name: "Mia",
      email: "mia@example.com",
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Name"), "Mia");
    await user.type(screen.getByLabelText("Email"), "mia@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.type(screen.getByLabelText("Confirm password"), "password1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(registerUserMock).toHaveBeenCalledWith({
        name: "Mia",
        email: "mia@example.com",
        password: "password1",
      }),
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login"));
  });

  it("shows the server error message when registration fails", async () => {
    registerUserMock.mockRejectedValue(
      new ApiError("Email already registered", 400),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText("Name"), "Mia");
    await user.type(screen.getByLabelText("Email"), "mia@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.type(screen.getByLabelText("Confirm password"), "password1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Email already registered"),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
