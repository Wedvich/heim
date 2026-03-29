import * as Sentry from "@sentry/node";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pool } from "./db.ts";
import "./session-context.ts";
import { logger } from "./logger.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { requestContextMiddleware } from "./middleware/request-context.ts";
import { sessionMiddleware } from "./middleware/session.ts";
import { createAuthRouter } from "./routes/auth.ts";
import { createTenantsRouter } from "./routes/tenants.ts";
import { createSyncRouter } from "./routes/sync.ts";
import { OidcVerifierRegistry } from "./auth/oidc/registry.ts";
import { GoogleOidcVerifier } from "./auth/oidc/google-verifier.ts";
import {
  CommandHandlerRegistry,
  inventoryItemHandler,
  productTypeHandler,
  roomHandler,
  tenantHandler,
} from "@heim/domain";
import { LocalKeyManagementService } from "./crypto/kms.ts";
import { requireEnv } from "./env.ts";
import { ProjectorRegistry } from "./event-store/projector-registry.ts";
import { registerTenantProjectors } from "./projectors/tenant-projectors.ts";

const googleClientId = requireEnv("GOOGLE_CLIENT_ID");
const emailHmacKey = requireEnv("EMAIL_HMAC_KEY");
const masterEncryptionKey = requireEnv("MASTER_ENCRYPTION_KEY");

const regTokenSecret = Buffer.from(requireEnv("REG_TOKEN_SECRET"), "base64");
if (regTokenSecret.length !== 32) {
  throw new Error("REG_TOKEN_SECRET must be 32 bytes (base64-encoded)");
}

const origin = requireEnv("CORS_ORIGIN")
  .split(",")
  .map((o) => o.trim());

const app = express();
app.set("etag", false);
app.set("x-powered-by", false);

const port = 5244;

const oidcRegistry = new OidcVerifierRegistry();
oidcRegistry.register(new GoogleOidcVerifier({ clientId: googleClientId }));

const kms = new LocalKeyManagementService(masterEncryptionKey);

const commandRegistry = new CommandHandlerRegistry()
  .register(productTypeHandler)
  .register(inventoryItemHandler)
  .register(roomHandler)
  .register(tenantHandler);

const projectorRegistry = new ProjectorRegistry();
registerTenantProjectors(projectorRegistry);

app.use(helmet({ hsts: false }));
app.use(
  cors({ allowedHeaders: ["Content-Type", "sentry-trace", "baggage"], credentials: true, origin }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);
app.use(requestContextMiddleware);
app.use(sessionMiddleware);

app.use(function sentryContextMiddleware(req, _res, next) {
  if (req.session) {
    Sentry.setUser({ id: req.session.principalId });
    Sentry.setTag("tenant_id", req.session.tenantId);
  }
  next();
});

app.get("/api/health", function healthCheck(_req, res) {
  res.json({ status: "ok" });
});

app.use("/api/auth", createAuthRouter(oidcRegistry, emailHmacKey, kms, regTokenSecret));
app.use("/api/tenants", createTenantsRouter());
app.use("/api/sync", createSyncRouter(pool, kms, commandRegistry, projectorRegistry));

Sentry.setupExpressErrorHandler(app);

app.use(function unhandledErrorHandler(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  logger.error(err, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const server = app.listen(port, () => {
  logger.info("API listening on port %d", port);
});

function shutdown() {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
