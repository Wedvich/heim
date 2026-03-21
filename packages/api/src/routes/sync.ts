import { Router } from "express";
import type { Pool } from "pg";
import { AGGREGATE_REGISTRY, buildAggregate } from "@heim/domain";
import type { KeyManagementService } from "../crypto/kms.ts";
import { loadTenantEvents, type HydratedTenantEvent } from "../event-store/load-tenant-events.ts";

interface AggregateSnapshot {
  streamId: string;
  streamType: string;
  version: number;
  state: Record<string, unknown>;
}

export function createSyncRouter(pool: Pool, kms: KeyManagementService): Router {
  const router = Router();

  router.get("/bootstrap", async (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { tenantId } = req.session;

    const client = await pool.connect();
    let events: HydratedTenantEvent[];
    try {
      events = await loadTenantEvents(client, kms, tenantId);
    } finally {
      client.release();
    }

    const grouped = new Map<string, HydratedTenantEvent[]>();
    for (const event of events) {
      let group = grouped.get(event.streamId);
      if (!group) {
        group = [];
        grouped.set(event.streamId, group);
      }
      group.push(event);
    }

    const snapshots: AggregateSnapshot[] = [];
    for (const [streamId, streamEvents] of grouped) {
      const streamType = streamEvents[0]!.streamType;
      const config = AGGREGATE_REGISTRY[streamType];
      if (!config) continue;

      const aggregate = buildAggregate(config.initial, streamEvents, config.apply);
      snapshots.push({
        streamId,
        streamType,
        version: aggregate.version,
        state: aggregate.state as Record<string, unknown>,
      });
    }

    const cursor = events.length > 0 ? events[events.length - 1]!.globalPosition : "0";

    res.json({ snapshots, cursor });
  });

  return router;
}
