import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { RegisterPage } from "./pages/RegisterPage.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";
import { PreferencesPage } from "./pages/PreferencesPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { AdminDashboardPage } from "./pages/AdminDashboardPage.tsx";
import { AuthProvider } from "./lib/AuthContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { installGlobalErrorReporting } from "./lib/reportError.ts";

installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
