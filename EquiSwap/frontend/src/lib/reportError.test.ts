import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("client error reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(undefined),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends error details and context to the reporting endpoint", async () => {
    const { reportClientError } = await import("./reportError");
    const error = new Error("Something went wrong");

    reportClientError(error, { source: "test" });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/client-errors",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(
      expect.objectContaining({
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        user_agent: navigator.userAgent,
        context: { source: "test" },
      }),
    );
  });

  it("limits reports per module instance", async () => {
    const { reportClientError } = await import("./reportError");

    for (let index = 0; index < 11; index += 1) {
      reportClientError(`error ${index}`);
    }

    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it("does not throw if sending a report fails synchronously", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("network unavailable");
      }),
    );
    const { reportClientError } = await import("./reportError");

    expect(() => reportClientError("failure")).not.toThrow();
  });

  it("reports uncaught window errors and unhandled rejections", async () => {
    const { installGlobalErrorReporting } = await import("./reportError");
    installGlobalErrorReporting();

    window.dispatchEvent(
      new ErrorEvent("error", {
        error: new Error("window error"),
        message: "window error",
      }),
    );

    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", {
      value: new Error("rejected promise"),
    });
    window.dispatchEvent(rejection);

    const requests = vi.mocked(fetch).mock.calls.map(([, options]) =>
      JSON.parse(options?.body as string),
    );
    expect(requests).toHaveLength(2);
    expect(requests[0].context).toEqual({ source: "window.error" });
    expect(requests[1].context).toEqual({ source: "unhandledrejection" });
  });
});
