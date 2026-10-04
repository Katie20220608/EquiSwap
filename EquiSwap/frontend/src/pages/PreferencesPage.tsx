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
  const [directoryState, setDirectoryState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [preferencesReload, setPreferencesReload] = useState(0);
  const [directoryReload, setDirectoryReload] = useState(0);

  const [avoidUserId, setAvoidUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting">("idle");
  const [removingPreferenceIds, setRemovingPreferenceIds] = useState<number[]>(
    [],
  );
  const [removeErrors, setRemoveErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setListState("loading");
    setListError(null);

    listMyPreferences()
      .then((preferenceList) => {
        if (cancelled) return;
        setPreferences(preferenceList);
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
  }, [user, preferencesReload]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    listUserDirectory()
      .then((userList) => {
        if (cancelled) return;
        setUsers(userList);
        setDirectoryState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setDirectoryError(
          err instanceof ApiError
            ? err.message
            : "Unable to load the user directory.",
        );
        setDirectoryState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user, directoryReload]);

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
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = availableUsers.filter((candidate) =>
    candidate.name.toLowerCase().includes(normalizedUserSearch),
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
      setUserSearch("");
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
    setRemovingPreferenceIds((current) => [...current, entry.uf_id]);
    setRemoveErrors((current) => {
      const next = { ...current };
      delete next[entry.uf_id];
      return next;
    });

    try {
      await deletePreference(entry.uf_id);
      setPreferences((current) =>
        current.filter((item) => item.uf_id !== entry.uf_id),
      );
    } catch (err) {
      setRemoveErrors((current) => ({
        ...current,
        [entry.uf_id]:
          err instanceof ApiError
            ? err.message
            : "Unable to remove this user from your blacklist.",
      }));
    } finally {
      setRemovingPreferenceIds((current) =>
        current.filter((id) => id !== entry.uf_id),
      );
    }
  }

  function retryDirectoryLoad() {
    setDirectoryState("loading");
    setDirectoryError(null);
    setDirectoryReload((current) => current + 1);
  }

  return (
    <main className="profile-shell preferences-shell">
      <TopNav eyebrow="EquiSwap / your account" heading="Preferences" />
      <div className="profile-card preferences-card">
        <h1>Blacklist management</h1>
        <p className="auth-subtitle">
          Users you blacklist will never be matched with you in a swap cycle.
        </p>

        <form
          className="auth-form preferences-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="auth-field">
            <label htmlFor="blacklist-search">Find a user to avoid</label>
            <input
              id="blacklist-search"
              type="search"
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value);
                setAvoidUserId("");
              }}
              disabled={directoryState !== "ready"}
              placeholder="Search users by name"
              autoComplete="off"
            />
            <label htmlFor="blacklist-user">Select user</label>
            <select
              id="blacklist-user"
              value={avoidUserId}
              onChange={(event) => setAvoidUserId(event.target.value)}
              disabled={directoryState !== "ready" || filteredUsers.length === 0}
            >
              <option value="">Choose a user...</option>
              {filteredUsers.map((candidate) => (
                <option key={candidate.user_id} value={candidate.user_id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            {directoryState === "loading" && <p>Loading users...</p>}
            {directoryState === "error" && (
              <div className="preference-inline-error">
                <p className="field-error" role="alert">
                  {directoryError}
                </p>
                <button
                  type="button"
                  className="blacklist-remove-button"
                  onClick={retryDirectoryLoad}
                >
                  Retry loading users
                </button>
              </div>
            )}
            {directoryState === "ready" && availableUsers.length === 0 && (
              <p className="preference-help">
                There are no users available to add.
              </p>
            )}
            {directoryState === "ready" &&
              availableUsers.length > 0 &&
              filteredUsers.length === 0 && (
                <p className="preference-help">
                  No users match "{userSearch}".
                </p>
              )}
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
          {listState === "error" && (
            <p className="preference-help">
              Retry loading your blacklist before adding someone.
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={
              formStatus === "submitting" ||
              listState !== "ready" ||
              directoryState !== "ready" ||
              availableUsers.length === 0
            }
          >
            {formStatus === "submitting" ? "Adding..." : "Add to blacklist"}
          </button>
        </form>

        <section
          className="trust-history preferences-list"
          aria-labelledby="blacklist-heading"
        >
          <h3 id="blacklist-heading">Blacklisted users</h3>

          {listState === "loading" && <p>Loading your blacklist...</p>}
          {listState === "error" && (
            <div className="preference-inline-error">
              <p className="field-error" role="alert">
                {listError}
              </p>
              <button
                type="button"
                className="blacklist-remove-button"
                onClick={() =>
                  setPreferencesReload((current) => current + 1)
                }
              >
                Retry loading blacklist
              </button>
            </div>
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
                    {removeErrors[entry.uf_id] && (
                      <span className="field-error" role="alert">
                        {removeErrors[entry.uf_id]}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="blacklist-remove-button"
                    disabled={removingPreferenceIds.includes(entry.uf_id)}
                    onClick={() => handleRemove(entry)}
                  >
                    {removingPreferenceIds.includes(entry.uf_id)
                      ? "Removing..."
                      : "Remove"}
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
