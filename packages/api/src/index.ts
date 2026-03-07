import express from "express";
import { pool } from "./db.ts";
import "./session-context.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { createAuthRouter } from "./routes/auth.ts";
import { OidcVerifierRegistry } from "./auth/oidc/registry.ts";
import { GoogleOidcVerifier } from "./auth/oidc/google-verifier.ts";

const app = express();
const port = 5244;

const oidcRegistry = new OidcVerifierRegistry();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (googleClientId) {
  oidcRegistry.register(new GoogleOidcVerifier({ clientId: googleClientId }));
}

app.use(express.json());
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", createAuthRouter(oidcRegistry));

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
