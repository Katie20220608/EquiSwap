import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SwapCard } from "./SwapCard";

describe("SwapCard", () => {
  it("renders the proposal details and action", () => {
    render(
      <SwapCard
        itemName="Ceramic pour-over set"
        owner="Mia Thompson"
        wants="Handmade wool throw"
        status="Awaiting response"
        accent="ochre"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Ceramic pour-over set" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mia Thompson")).toBeInTheDocument();
    expect(screen.getByText("Handmade wool throw")).toBeInTheDocument();
    expect(screen.getByText("Awaiting response")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view proposal/i }),
    ).toBeInTheDocument();
  });

  it("applies the selected accent to the card", () => {
    const { container } = render(
      <SwapCard
        itemName="35mm film camera"
        owner="Jordan Lee"
        wants="Desk lamp"
        status="Ready to swap"
        accent="sea"
      />,
    );

    expect(container.firstElementChild).toHaveClass("swap-card", "sea");
  });
});
