import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiSwapMessage } from "../lib/api";
import { SwapChat } from "./SwapChat";

const existingMessage: ApiSwapMessage = {
  message_id: 1,
  cycle_id: "cycle-1",
  sender_id: 2,
  sender_name: "Jordan",
  message: "Meet at the library at 3 pm?",
  created_at: "2026-10-04T10:00:00Z",
};

describe("SwapChat", () => {
  it("loads the thread and sends a message", async () => {
    const listMessages = vi.fn().mockResolvedValue([existingMessage]);
    const sendMessage = vi.fn().mockResolvedValue({
      ...existingMessage,
      message_id: 2,
      sender_id: 1,
      sender_name: "Mia",
      message: "That works for me.",
    });
    const user = userEvent.setup();

    render(
      <SwapChat
        cycleId="cycle-1"
        listMessages={listMessages}
        sendMessage={sendMessage}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(existingMessage.message),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message"), "That works for me.");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(sendMessage).toHaveBeenCalledWith("cycle-1", "That works for me.");
    expect(await screen.findByText("That works for me.")).toBeInTheDocument();
  });

  it("scrolls the conversation into view when opened", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <SwapChat
        cycleId="cycle-1"
        listMessages={vi.fn().mockResolvedValue([])}
        sendMessage={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  });
});
