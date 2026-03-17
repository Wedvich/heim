import { Router } from "express";
import type { Pool } from "pg";
import type { KeyManagementService } from "../crypto/kms.ts";
import { loadHydratedUserStream } from "../event-store/load-user-stream.ts";

export function createUserRouter(pool: Pool, kms: KeyManagementService): Router {
  const router = Router();

  router.get("/me/events", async (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { principalId, tenantId } = req.session;

    const rawAfterVersion = req.query.afterVersion;
    const afterVersion =
      typeof rawAfterVersion === "string" && /^\d+$/.test(rawAfterVersion)
        ? parseInt(rawAfterVersion, 10)
        : 0;

    const client = await pool.connect();
    let allEvents;
    try {
      allEvents = await loadHydratedUserStream(client, kms, tenantId, principalId);
    } finally {
      client.release();
    }

    const version = allEvents.length > 0 ? Math.max(...allEvents.map((e) => e.streamPosition)) : 0;
    const events = allEvents.filter((e) => e.streamPosition > afterVersion);

    res.json({ events, version });
  });

  return router;
}
