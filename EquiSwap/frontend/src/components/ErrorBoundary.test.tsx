import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import * as reporter from "../lib/reportError";

function Boom(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders children when nothing fails", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a fallback and reports the error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const report = vi
      .spyOn(reporter, "reportClientError")
      .mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(
      screen.getByRole("button", { name: "Reload page" }),
    ).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: "kaboom" }),
      expect.objectContaining({ source: "react.error-boundary" }),
    );
  });
});
