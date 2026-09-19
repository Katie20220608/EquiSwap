import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { ApiError, registerUser } from "../lib/api";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = "Name is required.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("idle");
      return;
    }

    setStatus("submitting");
    try {
      await registerUser({ name, email, password });
      setStatus("submitted");
      navigate("/login");
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
      title="Join EquiSwap."
      subtitle="Create an account to start swapping."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "register-name-error" : undefined}
            autoComplete="name"
          />
          {errors.name && (
            <p className="field-error" id="register-name-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            autoComplete="email"
          />
          {errors.email && (
            <p className="field-error" id="register-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "register-password-error" : undefined
            }
            autoComplete="new-password"
          />
          {errors.password && (
            <p className="field-error" id="register-password-error">
              {errors.password}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword
                ? "register-confirm-password-error"
                : undefined
            }
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="field-error" id="register-confirm-password-error">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {status === "submitted" && (
          <p className="form-success" role="status">
            Account created. You can now log in.
          </p>
        )}

        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          className="auth-submit"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
