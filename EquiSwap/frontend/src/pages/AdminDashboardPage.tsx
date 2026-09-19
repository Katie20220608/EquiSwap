import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ApiError, listAdminUsers } from "../lib/api";
import type { ApiAdminUser } from "../lib/api";
import { TopNav } from "../components/TopNav";
import "./AdminDashboard.css";

type LoadState = "loading" | "ready" | "error";

export function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    let cancelled = false;
    setLoadState("loading");

    listAdminUsers()
      .then((result) => {
        if (cancelled) return;
        setUsers(result);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load admin dashboard. Please try again.",
        );
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <main className="dashboard-shell">
        <p className="eyebrow">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="dashboard-shell">
      <TopNav eyebrow="EquiSwap / admin" heading="Admin dashboard" />

      {loadState === "loading" && <p>Loading users...</p>}
      {loadState === "error" && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {loadState === "ready" && (
        <section className="admin-panel" aria-labelledby="admin-users-heading">
          <h2 id="admin-users-heading">All users</h2>
          {users.length === 0 && (
            <p className="dashboard-empty">No users found.</p>
          )}
          <ul className="admin-user-list">
            {users.map((u) => (
              <li key={u.user_id} className="admin-user-card">
                <div className="admin-user-header">
                  <div>
                    <h3>{u.name}</h3>
                    <p className="admin-user-email">{u.email}</p>
                  </div>
                  <dl className="admin-user-stats">
                    <div>
                      <dt>Role</dt>
                      <dd>{u.role}</dd>
                    </div>
                    <div>
                      <dt>Trust</dt>
                      <dd>{u.trust_score}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{u.is_active ? "Active" : "Inactive"}</dd>
                    </div>
                  </dl>
                </div>

                <h4>Posted items ({u.items.length})</h4>
                {u.items.length === 0 ? (
                  <p className="dashboard-empty">No items posted.</p>
                ) : (
                  <ul className="admin-item-list">
                    {u.items.map((item) => (
                      <li key={item.item_id} className="admin-item-row">
                        <span className="admin-item-name">{item.name}</span>
                        <span className="admin-item-status">{item.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
