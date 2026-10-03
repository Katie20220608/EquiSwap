import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, type ApiSwapMessage } from "../lib/api";
import "./SwapChat.css";

type SwapChatProps = {
  cycleId: string;
  listMessages: (cycleId: string) => Promise<ApiSwapMessage[]>;
  sendMessage: (cycleId: string, message: string) => Promise<ApiSwapMessage>;
  onClose: () => void;
};

export function SwapChat({
  cycleId,
  listMessages,
  sendMessage,
  onClose,
}: SwapChatProps) {
  const chatRef = useRef<HTMLElement | null>(null);
  const [messages, setMessages] = useState<ApiSwapMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chatRef.current?.scrollIntoView === "function") {
      chatRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [cycleId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshMessages() {
      try {
        const latest = await listMessages(cycleId);
        if (!cancelled) {
          setMessages(latest);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load swap messages.",
          );
          setIsLoading(false);
        }
      }
    }

    void refreshMessages();
    const intervalId = window.setInterval(() => void refreshMessages(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [cycleId, listMessages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) return;

    setError(null);
    setIsSending(true);
    try {
      const created = await sendMessage(cycleId, message);
      setMessages((current) => [...current, created]);
      setDraft("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to send your message.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      ref={chatRef}
      className="swap-chat"
      aria-label="Swap group messages"
      tabIndex={-1}
    >
      <div className="swap-chat-heading">
        <div>
          <h3>Coordinate this exchange</h3>
          <p>Agree on a time and place with everyone in the swap.</p>
        </div>
        <button
          type="button"
          className="dashboard-toggle"
          onClick={onClose}
          aria-label="Close swap messages"
        >
          Close
        </button>
      </div>

      <div className="swap-chat-messages" aria-live="polite">
        {isLoading ? (
          <p className="dashboard-empty">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="dashboard-empty">Start the conversation here.</p>
        ) : (
          messages.map((message) => (
            <article className="swap-chat-message" key={message.message_id}>
              <div className="swap-chat-message-meta">
                <strong>{message.sender_name}</strong>
                {message.created_at && (
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString()}
                  </time>
                )}
              </div>
              <p>{message.message}</p>
            </article>
          ))
        )}
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <form className="swap-chat-form" onSubmit={handleSubmit}>
        <label htmlFor={`swap-message-${cycleId}`}>Message</label>
        <textarea
          id={`swap-message-${cycleId}`}
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Where and when should you meet?"
          rows={2}
        />
        <button
          type="submit"
          className="dashboard-toggle"
          disabled={!draft.trim() || isSending}
        >
          {isSending ? "Sending..." : "Send message"}
        </button>
      </form>
    </section>
  );
}
