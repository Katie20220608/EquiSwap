import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ApiError, changePassword, getUserTrustScore } from "../lib/api";
import type { ApiTrustLog } from "../lib/api";
import { TopNav } from "../components/TopNav";
import "./Auth.css";

function formatLoggedAt(loggedAt: string | null): string {
  if (!loggedAt) return "Date unavailable";
  const date = new Date(loggedAt);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [trustHistory, setTrustHistory] = useState<ApiTrustLog[]>([]);
  const [historyState, setHistoryState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] =
    useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "submitting">(
    "idle",
  );
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setHistoryState("loading");

    getUserTrustScore(user.user_id)
      .then((result) => {
        if (cancelled) return;
        setTrustHistory(result.history);
        setHistoryState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryError(
          err instanceof ApiError
            ? err.message
            : "Unable to load your trust score history.",
        );
        setHistoryState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isLoading) {
    return (
      <main className="profile-shell">
        <div className="profile-card">
          <p className="eyebrow">Loading your profile...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation must match.");
      return;
    }

    setPasswordStatus("submitting");
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Unable to update your password.",
      );
    } finally {
      setPasswordStatus("idle");
    }
  }

  return (
    <main className="profile-shell">
      <TopNav eyebrow="EquiSwap / your account" heading="Your profile" />
      <div className="profile-card">
        <h1>Welcome, {user.name}.</h1>
        <p className="auth-subtitle">{user.email}</p>

        <dl className="profile-stats">
          <div>
            <dt>Trust score</dt>
            <dd>{user.trust_score}</dd>
          </div>
          <div>
            <dt>Rejections</dt>
            <dd>{user.rejection_count}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user.is_active ? "Active" : "Inactive"}</dd>
          </div>
        </dl>

        <section className="trust-history" aria-labelledby="password-heading">
          <h3 id="password-heading">Change password</h3>
          <form
            className="auth-form"
            onSubmit={handlePasswordChange}
            noValidate
          >
            <div className="auth-field">
              <label htmlFor="current-password">Current password</label>
              <div className="password-input">
                <input
                  id="current-password"
                  type={isCurrentPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    isCurrentPasswordVisible
                      ? "Hide current password"
                      : "Show current password"
                  }
                  aria-pressed={isCurrentPasswordVisible}
                  onClick={() =>
                    setIsCurrentPasswordVisible((visible) => !visible)
                  }
                >
                  {isCurrentPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="new-password">New password</label>
              <div className="password-input">
                <input
                  id="new-password"
                  type={isNewPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    isNewPasswordVisible
                      ? "Hide new password"
                      : "Show new password"
                  }
                  aria-pressed={isNewPasswordVisible}
                  onClick={() => setIsNewPasswordVisible((visible) => !visible)}
                >
                  {isNewPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm new password</label>
              <div className="password-input">
                <input
                  id="confirm-password"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    isConfirmPasswordVisible
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={isConfirmPasswordVisible}
                  onClick={() =>
                    setIsConfirmPasswordVisible((visible) => !visible)
                  }
                >
                  {isConfirmPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {passwordError && (
              <p className="field-error" role="alert">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="form-success">{passwordSuccess}</p>
            )}
            <button
              type="submit"
              className="auth-submit"
              disabled={passwordStatus === "submitting"}
            >
              {passwordStatus === "submitting"
                ? "Updating..."
                : "Update password"}
            </button>
          </form>
        </section>

        <section
          className="trust-history"
          aria-labelledby="trust-history-heading"
        >
          <h3 id="trust-history-heading">Trust score history</h3>

          {historyState === "loading" && <p>Loading trust score history...</p>}
          {historyState === "error" && (
            <p className="field-error" role="alert">
              {historyError}
            </p>
          )}
          {historyState === "ready" && trustHistory.length === 0 && (
            <p className="dashboard-empty">No trust score changes yet.</p>
          )}
          {historyState === "ready" && trustHistory.length > 0 && (
            <ul className="trust-history-list">
              {trustHistory.map((entry) => (
                <li key={entry.tl_id} className="trust-history-item">
                  <span
                    className={
                      entry.score_change >= 0
                        ? "trust-history-change trust-history-increase"
                        : "trust-history-change trust-history-decrease"
                    }
                  >
                    {entry.score_change >= 0 ? "+" : ""}
                    {entry.score_change}
                  </span>
                  <span className="trust-history-details">
                    <span className="trust-history-action">
                      {entry.action.replace("_", " ")}
                    </span>
                    {entry.description && (
                      <span className="trust-history-description">
                        {entry.description}
                      </span>
                    )}
                    <span className="trust-history-date">
                      {formatLoggedAt(entry.logged_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
