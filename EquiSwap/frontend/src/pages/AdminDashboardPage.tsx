import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  ApiError,
  getAdminStats,
  getAdminSwapInsights,
  getAdminUserDetail,
  listAdminUsers,
  setAdminUserStatus,
} from "../lib/api";
import type {
  ApiAdminStats,
  ApiAdminSwapInsights,
  ApiAdminUser,
  ApiAdminUserDetail,
  ApiDailyCount,
} from "../lib/api";
import { TopNav } from "../components/TopNav";
import "./AdminDashboard.css";

type LoadState = "loading" | "ready" | "error";

function BarChart({
  title,
  data,
  tone,
}: {
  title: string;
  data: ApiDailyCount[];
  tone: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure className={`admin-chart admin-tone-${tone}`}>
      <figcaption>{title}</figcaption>
      <div className="admin-chart-bars" role="img" aria-label={title}>
        {data.map((d) => (
          <div
            key={d.day}
            className="admin-chart-col"
            title={`${d.day}: ${d.count}`}
          >
            <span className="admin-chart-value">
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className="admin-chart-bar"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
            <span className="admin-chart-day">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function StatsOverview({ stats }: { stats: ApiAdminStats }) {
  const cards: [string, number, string][] = [
    ["Users", stats.total_users, "blue"],
    ["New users (7d)", stats.new_users_7d, "teal"],
    ["Items", stats.total_items, "purple"],
    ["Available items", stats.available_items, "green"],
    ["Open swaps", stats.open_swaps, "orange"],
    ["Completed swaps", stats.completed_swaps, "pink"],
  ];
  const statuses = Object.entries(stats.proposal_status_counts);
  const funnelMax = Math.max(1, ...statuses.map(([, n]) => n));

  return (
    <section className="admin-panel" aria-labelledby="admin-overview-heading">
      <h2 id="admin-overview-heading">Platform overview</h2>
      <dl className="admin-stat-cards">
        {cards.map(([label, value, tone]) => (
          <div key={label} className={`admin-stat-card admin-tone-${tone}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="admin-chart-row">
        <BarChart
          title="Sign-ups (last 14 days)"
          data={stats.signups_per_day}
          tone="blue"
        />
        <BarChart
          title="Completed swaps (last 14 days)"
          data={stats.swaps_per_day}
          tone="green"
        />
      </div>
      <div className="admin-chart-row">
        <div>
          <h3>Swap status</h3>
          {statuses.length === 0 && (
            <p className="dashboard-empty">No swaps yet.</p>
          )}
          <ul className="admin-hbar-list">
            {statuses.map(([status, n]) => (
              <li key={status} className={`admin-status-${status}`}>
                <span className="admin-status-name">{status}</span>
                <span className="admin-hbar-track">
                  <span
                    className="admin-hbar"
                    style={{ width: `${(n / funnelMax) * 100}%` }}
                  />
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Top categories</h3>
          {stats.top_categories.length === 0 && (
            <p className="dashboard-empty">No category data.</p>
          )}
          <table className="admin-category-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Items</th>
                <th>Wishlisted</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_categories.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td>
                    <span className="admin-pill admin-tone-purple">
                      {c.items}
                    </span>
                  </td>
                  <td>
                    <span className="admin-pill admin-tone-pink">
                      {c.wishlists}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SwapInsightsPanel({ insights }: { insights: ApiAdminSwapInsights }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const outcomes = Object.entries(insights.outcome_counts);
  const outcomeMax = Math.max(1, ...outcomes.map(([, n]) => n));
  const cards: [string, string, string][] = [
    ["Swap cycles", String(insights.total_cycles), "blue"],
    ["Success rate", pct(insights.success_rate), "green"],
    ["Avg cycle length", insights.average_cycle_length.toFixed(1), "purple"],
    [
      "Avg hours to complete",
      insights.average_hours_to_complete === null
        ? "-"
        : String(insights.average_hours_to_complete),
      "teal",
    ],
    ["Stale pending", String(insights.stale_pending_cycles), "orange"],
  ];

  return (
    <section className="admin-panel" aria-labelledby="admin-insights-heading">
      <h2 id="admin-insights-heading">Swap-cycle insights</h2>
      {insights.total_cycles === 0 ? (
        <p className="dashboard-empty">No swap cycles yet.</p>
      ) : (
        <>
          <dl className="admin-stat-cards">
            {cards.map(([label, value, tone]) => (
              <div key={label} className={`admin-stat-card admin-tone-${tone}`}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="admin-chart-row">
            <div>
              <h3>Cycle outcomes</h3>
              <ul className="admin-hbar-list">
                {outcomes.map(([outcome, n]) => (
                  <li key={outcome} className={`admin-status-${outcome}`}>
                    <span className="admin-status-name">{outcome}</span>
                    <span className="admin-hbar-track">
                      <span
                        className="admin-hbar"
                        style={{ width: `${(n / outcomeMax) * 100}%` }}
                      />
                    </span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Success by cycle length</h3>
              <table className="admin-category-table">
                <thead>
                  <tr>
                    <th>Users in cycle</th>
                    <th>Cycles</th>
                    <th>Completed</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.by_length.map((row) => (
                    <tr key={row.length}>
                      <td>{row.length}</td>
                      <td>{row.total}</td>
                      <td>{row.completed}</td>
                      <td>
                        <span className="admin-pill admin-tone-green">
                          {pct(row.success_rate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <h3>Top rejection reasons</h3>
          {insights.top_rejection_reasons.length === 0 ? (
            <p className="dashboard-empty">No rejection reasons recorded.</p>
          ) : (
            <ul className="admin-reason-list">
              {insights.top_rejection_reasons.map((r) => (
                <li key={r.reason}>
                  <span>{r.reason}</span>
                  <span className="admin-pill admin-tone-pink">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function UserDetailPanel({
  detail,
  onClose,
}: {
  detail: ApiAdminUserDetail;
  onClose: () => void;
}) {
  const { user: u, swap_counts: sc } = detail;
  const counts: [string, number][] = [
    ["Proposals given", sc.given],
    ["Proposals received", sc.received],
    ["Completed swaps", sc.completed],
    ["Rejected", sc.rejected],
    ["Wishlist", detail.wishlist_count],
  ];
  return (
    <section className="admin-detail" aria-label={`Details for ${u.name}`}>
      <div className="admin-detail-header">
        <div>
          <h3>{u.name}</h3>
          <p className="admin-user-email">{u.email}</p>
        </div>
        <button type="button" className="admin-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="admin-stat-cards">
        {counts.map(([label, value]) => (
          <div key={label} className="admin-stat-card admin-tone-blue">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h4>Items ({detail.items.length})</h4>
      {detail.items.length === 0 ? (
        <p className="dashboard-empty">No items posted.</p>
      ) : (
        <ul className="admin-item-list">
          {detail.items.map((item) => (
            <li key={item.item_id} className="admin-item-row">
              <span className="admin-item-name">{item.name}</span>
              <span className="admin-item-status">{item.status}</span>
            </li>
          ))}
        </ul>
      )}
      <h4>Recent trust activity</h4>
      {detail.recent_trust_logs.length === 0 ? (
        <p className="dashboard-empty">No trust activity.</p>
      ) : (
        <ul className="admin-reason-list">
          {detail.recent_trust_logs.map((log) => (
            <li key={log.tl_id}>
              <span>{log.description ?? log.action}</span>
              <span
                className={`admin-pill ${log.score_change < 0 ? "admin-tone-pink" : "admin-tone-green"}`}
              >
                {log.score_change > 0
                  ? `+${log.score_change}`
                  : log.score_change}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<ApiAdminUser[]>([]);
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [insights, setInsights] = useState<ApiAdminSwapInsights | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "suspended">(
    "",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiAdminUserDetail | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setLoadState("loading");

    Promise.all([getAdminStats(), getAdminSwapInsights()])
      .then(([statsResult, insightsResult]) => {
        if (cancelled) return;
        setStats(statsResult);
        setInsights(insightsResult);
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
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      listAdminUsers({
        q: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      })
        .then((result) => {
          if (cancelled) return;
          setUsers(result);
          setLoadState((s) => (s === "error" ? s : "ready"));
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
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAdmin, search, roleFilter, statusFilter]);

  const toggleSuspend = useCallback(async (target: ApiAdminUser) => {
    setActionError(null);
    try {
      const updated = await setAdminUserStatus(
        target.user_id,
        !target.is_active,
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === updated.user_id
            ? { ...u, is_active: updated.is_active }
            : u,
        ),
      );
      setDetail((d) =>
        d && d.user.user_id === updated.user_id
          ? { ...d, user: { ...d.user, is_active: updated.is_active } }
          : d,
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Unable to update user status.",
      );
    }
  }, []);

  const openDetail = useCallback(async (userId: number) => {
    setActionError(null);
    try {
      setDetail(await getAdminUserDetail(userId));
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Unable to load user details.",
      );
    }
  }, []);

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

      {loadState === "ready" && stats && <StatsOverview stats={stats} />}
      {loadState === "ready" && insights && (
        <SwapInsightsPanel insights={insights} />
      )}

      {loadState === "ready" && (
        <section className="admin-panel" aria-labelledby="admin-users-heading">
          <h2 id="admin-users-heading">All users</h2>
          <div className="admin-filters">
            <input
              type="search"
              aria-label="Search users"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="parent">Parent</option>
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "" | "active" | "suspended")
              }
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {actionError && (
            <p className="field-error" role="alert">
              {actionError}
            </p>
          )}
          {detail && (
            <UserDetailPanel detail={detail} onClose={() => setDetail(null)} />
          )}
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
                      <dd>{u.is_active ? "Active" : "Suspended"}</dd>
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

                <div className="admin-user-actions">
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => openDetail(u.user_id)}
                  >
                    View details
                  </button>
                  {u.user_id !== user.user_id && u.role !== "admin" && (
                    <button
                      type="button"
                      className={`admin-btn ${u.is_active ? "admin-btn-danger" : ""}`}
                      onClick={() => toggleSuspend(u)}
                    >
                      {u.is_active ? "Suspend" : "Reactivate"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
