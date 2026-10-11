import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "../lib/reportError";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, {
      source: "react.error-boundary",
      componentStack: info.componentStack ?? "",
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <main className="error-fallback" role="alert">
        <h1>Something went wrong</h1>
        <p>
          EquiSwap hit an unexpected problem. Reloading usually fixes it, and
          your listings and swaps are safe.
        </p>
        <div className="error-fallback-actions">
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a href="/">Go to home</a>
        </div>
      </main>
    );
  }
}
