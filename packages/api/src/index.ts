import express from "express";
import { pool } from "./db.ts";
import "./session-context.ts";
import { requestContextMiddleware } from "./middleware/request-context.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { createAuthRouter } from "./routes/auth.ts";
import { createTenantsRouter } from "./routes/tenants.ts";
import { OidcVerifierRegistry } from "./auth/oidc/registry.ts";
import { GoogleOidcVerifier } from "./auth/oidc/google-verifier.ts";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (!googleClientId) {
  throw new Error("GOOGLE_CLIENT_ID is required");
}

const emailHmacKey = process.env.EMAIL_HMAC_KEY;
if (!emailHmacKey) {
  throw new Error("EMAIL_HMAC_KEY is required");
}

const app = express();
const port = 5244;

const oidcRegistry = new OidcVerifierRegistry();
oidcRegistry.register(new GoogleOidcVerifier({ clientId: googleClientId }));

app.use(express.json());
app.use(requestContextMiddleware);
app.use(sessionMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", createAuthRouter(oidcRegistry, emailHmacKey));
app.use("/api/tenants", createTenantsRouter());

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
