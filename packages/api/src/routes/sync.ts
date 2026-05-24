import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "pg";
import {
  AGGREGATE_REGISTRY,
  buildAggregate,
  type Command,
  type CommandHandlerRegistry,
  type SeedFile,
} from "@heim/domain";
import type { KeyManagementService } from "../crypto/kms.ts";
import { appendEvents } from "../event-store/append-events.ts";
import { loadStreamEvents } from "../event-store/load-stream-events.ts";
import { loadTenantEvents, type HydratedTenantEvent } from "../event-store/load-tenant-events.ts";
import type { ProjectorRegistry } from "../event-store/projector-registry.ts";

interface AggregateSnapshot {
  streamId: string;
  streamType: string;
  version: number;
  state: Record<string, unknown>;
}

interface CommandRequestBody {
  commandId: string;
  correlationId: string;
  causationId: string;
  streamId: string;
  streamType: string;
  type: string;
  payload: Record<string, unknown>;
  expectedVersion: number;
}

export function createSyncRouter(
  pool: Pool,
  kms: KeyManagementService,
  commandRegistry: CommandHandlerRegistry,
  projectorRegistry: ProjectorRegistry,
): Router {
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

  router.post("/commands", async (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { tenantId, principalId } = req.session;
    const body = req.body as CommandRequestBody;

    const config = AGGREGATE_REGISTRY[body.streamType];
    if (!config) {
      res.status(400).json({ error: "unknown_stream_type" });
      return;
    }

    const command: Command = {
      commandId: body.commandId,
      correlationId: body.correlationId,
      causationId: body.causationId,
      streamId: body.streamId,
      streamType: body.streamType,
      type: body.type,
      payload: body.payload,
      expectedVersion: body.expectedVersion,
      actualTime: new Date(),
      tenantId,
      actingPrincipalId: principalId,
      effectivePrincipalId: null,
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const streamEvents = await loadStreamEvents(client, tenantId, command.streamId);
      const aggregate = buildAggregate(config.initial, streamEvents, config.apply);

      if (aggregate.version !== command.expectedVersion) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "version_conflict",
          expected: command.expectedVersion,
          actual: aggregate.version,
        });
        return;
      }

      const result = commandRegistry.handle(aggregate.state, command, config);
      if (!result.ok) {
        await client.query("ROLLBACK");
        res.status(422).json({ error: "command_rejected", reason: result.reason });
        return;
      }

      await appendEvents(client, [...result.events]);
      await projectorRegistry.apply(client, result.events);
      await client.query("COMMIT");

      res.json({ ok: true, events: result.events });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: "internal_error" });
    } finally {
      client.release();
    }
  });

  router.post("/commands/batch", async (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const body = req.body as SeedFile;

    if (body.version !== 1) {
      res.status(400).json({ error: "unsupported_version" });
      return;
    }

    if (!Array.isArray(body.commands) || body.commands.length === 0) {
      res.status(400).json({ error: "empty_commands" });
      return;
    }

    const { tenantId, principalId } = req.session;
    const correlationId = randomUUID();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let imported = 0;

      for (let i = 0; i < body.commands.length; i++) {
        const seedCmd = body.commands[i]!;

        const config = AGGREGATE_REGISTRY[seedCmd.streamType];
        if (!config) {
          await client.query("ROLLBACK");
          res.status(400).json({
            error: "unknown_stream_type",
            index: i,
            streamType: seedCmd.streamType,
          });
          return;
        }

        const streamEvents = await loadStreamEvents(client, tenantId, seedCmd.streamId);
        const aggregate = buildAggregate(config.initial, streamEvents, config.apply);

        const commandId = randomUUID();
        const command: Command = {
          commandId,
          correlationId,
          causationId: `batch:${correlationId}`,
          streamId: seedCmd.streamId,
          streamType: seedCmd.streamType,
          type: seedCmd.type,
          payload: seedCmd.payload,
          expectedVersion: aggregate.version,
          actualTime: seedCmd.actualTime ? new Date(seedCmd.actualTime) : new Date(),
          tenantId,
          actingPrincipalId: principalId,
          effectivePrincipalId: null,
        };

        const result = commandRegistry.handle(aggregate.state, command, config);

        if (!result.ok) {
          await client.query("ROLLBACK");
          res.status(422).json({
            error: "command_rejected",
            index: i,
            reason: result.reason,
          });
          return;
        }

        await appendEvents(client, [...result.events]);
        await projectorRegistry.apply(client, result.events);
        imported++;
      }

      await client.query("COMMIT");
      res.json({ ok: true, imported });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ error: "internal_error" });
    } finally {
      client.release();
    }
  });

  return router;
}
