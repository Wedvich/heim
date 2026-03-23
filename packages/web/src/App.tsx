import * as Sentry from "@sentry/react";
import { Route, Routes } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegisterSetupPage } from "./pages/RegisterSetupPage";
import { SettingsPage } from "./pages/SettingsPage";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

export function App() {
  return (
    <SentryRoutes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/setup" element={<RegisterSetupPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </SentryRoutes>
  );
}
