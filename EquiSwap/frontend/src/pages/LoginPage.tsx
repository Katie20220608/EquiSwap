import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type FieldErrors = {
  email?: string;
  password?: string;
  form?: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    setStatus("submitting");
    try {
      await login(email, password);
      setStatus("submitted");
      navigate("/profile");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Unable to reach the server. Please try again.";
      setErrors({ form: message });
      setStatus("idle");
    }
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Log in to keep your swaps moving."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            autoComplete="email"
          />
          {errors.email && (
            <p className="field-error" id="login-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <div className="password-input">
            <input
              id="login-password"
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              aria-pressed={isPasswordVisible}
              onClick={() => setIsPasswordVisible((visible) => !visible)}
            >
              {isPasswordVisible ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="field-error" id="login-password-error">
              {errors.password}
            </p>
          )}
        </div>

        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}

        {status === "submitted" && (
          <p className="form-success" role="status">
            Signed in successfully.
          </p>
        )}

        <button
          type="submit"
          className="auth-submit"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="auth-switch">
        New to EquiSwap? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
