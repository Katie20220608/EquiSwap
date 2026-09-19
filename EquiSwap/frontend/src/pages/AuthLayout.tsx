import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./Auth.css";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link to="/" className="auth-home-link">
          ← Back to EquiSwap
        </Link>
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            E
          </div>
          <p className="eyebrow" style={{ margin: 0 }}>
            EquiSwap / exchange desk
          </p>
        </div>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
