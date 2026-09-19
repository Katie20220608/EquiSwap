import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CycleVisualisation } from "./CycleVisualisation";

describe("CycleVisualisation", () => {
  it("describes the cycle accessibly and renders every participant", () => {
    render(<CycleVisualisation participants={["Mia", "Jordan", "Sana"]} />);

    expect(
      screen.getByRole("img", {
        name: "Swap cycle between Mia, Jordan, Sana",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mia")).toBeInTheDocument();
    expect(screen.getByText("Jordan")).toBeInTheDocument();
    expect(screen.getByText("Sana")).toBeInTheDocument();
  });

  it("uses each participant's first character as the avatar", () => {
    render(<CycleVisualisation participants={["Mia", "Jordan"]} />);

    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("shows each swap item beside the participant without exposing user IDs", () => {
    render(
      <CycleVisualisation
        participants={[
          { name: "Mia", id: 8, itemName: "Ceramic pour-over set" },
          { name: "Jack", id: 14, itemName: "35mm film camera" },
        ]}
      />,
    );

    expect(screen.getByText("Ceramic pour-over set")).toBeInTheDocument();
    expect(screen.getByText("35mm film camera")).toBeInTheDocument();
    expect(screen.queryByText("User #8")).not.toBeInTheDocument();
    expect(screen.queryByText("User #14")).not.toBeInTheDocument();
  });
});
