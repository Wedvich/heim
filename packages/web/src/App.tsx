import { Route, Routes } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { RootRedirect } from "./components/RootRedirect";
import { TenantShell } from "./components/TenantShell";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route element={<RequireAuth />}>
        <Route path="/:tenantSlug" element={<TenantShell />}>
          <Route index element={<HomePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
