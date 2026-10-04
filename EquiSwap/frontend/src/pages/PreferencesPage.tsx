import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  ApiError,
  createPreference,
  deletePreference,
  listMyPreferences,
  listUserDirectory,
  type ApiPreference,
  type ApiUserDirectoryEntry,
} from "../lib/api";
import { TopNav } from "../components/TopNav";
import "./Auth.css";

export function PreferencesPage() {
  const { user, isLoading } = useAuth();
  const [preferences, setPreferences] = useState<ApiPreference[]>([]);
  const [users, setUsers] = useState<ApiUserDirectoryEntry[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [listError, setListError] = useState<string | null>(null);

  const [avoidUserId, setAvoidUserId] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting">("idle");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setListState("loading");

    Promise.all([listMyPreferences(), listUserDirectory()])
      .then(([preferenceList, userList]) => {
        if (cancelled) return;
        setPreferences(preferenceList);
        setUsers(userList);
        setListState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(
          err instanceof ApiError
            ? err.message
            : "Unable to load your blacklist.",
        );
        setListState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (isLoading) {
    return (
      <main className="profile-shell">
        <div className="profile-card">
          <p className="eyebrow">Loading your preferences...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const blacklistedIds = new Set(
    preferences.map((entry) => entry.avoid_user_id),
  );
  const availableUsers = users.filter(
    (candidate) => !blacklistedIds.has(candidate.user_id),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const userId = Number(avoidUserId);
    if (!avoidUserId || Number.isNaN(userId)) {
      setFormError("Choose a user to add to your blacklist.");
      return;
    }

    setFormStatus("submitting");
    try {
      const created = await createPreference(
        userId,
        reason.trim() || undefined,
      );
      setPreferences((current) => [...current, created]);
      setAvoidUserId("");
      setReason("");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Unable to add this user to your blacklist.",
      );
    } finally {
      setFormStatus("idle");
    }
  }

  async function handleRemove(entry: ApiPreference) {
    try {
      await deletePreference(entry.uf_id);
      setPreferences((current) =>
        current.filter((item) => item.uf_id !== entry.uf_id),
      );
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Unable to remove this user from your blacklist.",
      );
    }
  }

  return (
    <main className="profile-shell">
      <TopNav eyebrow="EquiSwap / your account" heading="Preferences" />
      <div className="profile-card">
        <h1>Blacklist management</h1>
        <p className="auth-subtitle">
          Users you blacklist will never be matched with you in a swap cycle.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="blacklist-user">User to avoid</label>
            <select
              id="blacklist-user"
              value={avoidUserId}
              onChange={(event) => setAvoidUserId(event.target.value)}
            >
              <option value="">Select a user...</option>
              {availableUsers.map((candidate) => (
                <option key={candidate.user_id} value={candidate.user_id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="blacklist-reason">Reason (optional)</label>
            <input
              id="blacklist-reason"
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={100}
              placeholder="e.g. Missed a previous swap"
            />
          </div>

          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={formStatus === "submitting"}
          >
            {formStatus === "submitting" ? "Adding..." : "Add to blacklist"}
          </button>
        </form>

        <section className="trust-history" aria-labelledby="blacklist-heading">
          <h3 id="blacklist-heading">Blacklisted users</h3>

          {listState === "loading" && <p>Loading your blacklist...</p>}
          {listState === "error" && (
            <p className="field-error" role="alert">
              {listError}
            </p>
          )}
          {listState === "ready" && preferences.length === 0 && (
            <p className="dashboard-empty">
              You haven't blacklisted anyone yet.
            </p>
          )}
          {listState === "ready" && preferences.length > 0 && (
            <ul className="trust-history-list">
              {preferences.map((entry) => (
                <li key={entry.uf_id} className="trust-history-item">
                  <span className="trust-history-details">
                    <span className="trust-history-action">
                      {entry.avoid_user_name ?? `User #${entry.avoid_user_id}`}
                    </span>
                    {entry.reason && (
                      <span className="trust-history-description">
                        {entry.reason}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="blacklist-remove-button"
                    onClick={() => handleRemove(entry)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
