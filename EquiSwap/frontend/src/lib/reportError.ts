const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const MAX_REPORTS_PER_SESSION = 10;
let reportsSent = 0;

export function reportClientError(
  error: unknown,
  context: Record<string, string> = {},
): void {
  if (reportsSent >= MAX_REPORTS_PER_SESSION) {
    return;
  }
  reportsSent += 1;

  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    message: err.message,
    stack: err.stack ?? null,
    url: window.location.href,
    user_agent: navigator.userAgent,
    context,
  };

  try {
    void fetch(`${API_BASE_URL}/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never throw.
  }
}

export function installGlobalErrorReporting(): void {
  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, { source: "window.error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "unhandledrejection" });
  });
}
