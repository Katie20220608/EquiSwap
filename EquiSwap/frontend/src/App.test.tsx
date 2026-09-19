import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./lib/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("introduces EquiSwap as a parent swap community", () => {
    renderApp();

    expect(
      screen.getByRole("heading", {
        name: "Children outgrow things. Their next family is waiting.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/parents swap children's toys and learning resources/i),
    ).toBeInTheDocument();
  });

  it("explains the three parent swap steps and offers registration", () => {
    renderApp();

    expect(
      screen.getByText("List what your child has outgrown"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wishlist the next thing they need"),
    ).toBeInTheDocument();
    expect(screen.getByText("Follow a fair swap cycle")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", {
        name: /Join EquiSwap|Start your swap journey/,
      }),
    ).toHaveLength(2);
  });
});
