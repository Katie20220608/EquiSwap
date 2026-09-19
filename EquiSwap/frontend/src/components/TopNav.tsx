import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
  type ApiNotification,
} from "../lib/api";

type TopNavProps = {
  eyebrow: string;
  heading: string;
  children?: ReactNode;
};

export function TopNav({ eyebrow, heading, children }: TopNavProps) {
  const { user, isLoading, logout } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    async function loadNotifications() {
      try {
        const [items, count] = await Promise.all([
          listNotifications(),
          getUnreadNotificationCount(),
        ]);

        if (cancelled) return;
        setNotifications(items);
        setUnreadCount(count);
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleMarkRead(notification: ApiNotification) {
    if (notification.is_read) {
      return;
    }

    try {
      const updated = await markNotificationRead(notification.n_id);
      setNotifications((current) =>
        current.map((item) => (item.n_id === updated.n_id ? updated : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // Ignore notification-mark-read errors silently for a lightweight UX.
    }
  }

  return (
    <header className="topbar">
      <div className="brand-mark" aria-hidden="true">
        E
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
      </div>
      <nav className="auth-nav">
        <Link to="/">Home</Link>
        {!isLoading && user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/preferences">Preferences</Link>
            {user.role === "admin" && <Link to="/admin">Admin</Link>}
            <div className="notification-menu">
              <button
                type="button"
                className="notification-button"
                aria-label="Notifications"
                onClick={() => setIsOpen((current) => !current)}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
              {isOpen && (
                <div className="notification-panel" role="menu">
                  <div className="notification-panel-header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && <span>{unreadCount} unread</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notification-empty">No notifications yet.</p>
                  ) : (
                    <ul className="notification-list">
                      {notifications.slice(0, 5).map((notification) => (
                        <li
                          key={notification.n_id}
                          className={
                            notification.is_read ? "is-read" : "is-unread"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              void handleMarkRead(notification);
                              setIsOpen(false);
                            }}
                          >
                            <span className="notification-type">
                              {notification.type.replace("_", " ")}
                            </span>
                            <span className="notification-message">
                              {notification.message}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Link to="/profile" className="auth-nav-cta">
              {user.name} · Trust {user.trust_score}
            </Link>
            <button type="button" className="auth-nav-logout" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="auth-nav-cta">
              Sign up
            </Link>
          </>
        )}
      </nav>
      {children}
    </header>
  );
}
