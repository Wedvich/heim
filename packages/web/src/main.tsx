import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./index.css";
import { AuthProvider } from "./auth/auth-context";
import { SyncBootstrap } from "./sync/SyncBootstrap";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncBootstrap>
          <App />
        </SyncBootstrap>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
