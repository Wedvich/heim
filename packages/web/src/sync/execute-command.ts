import { AGGREGATE_REGISTRY, type DomainEvent } from "@heim/domain";
import { sendCommand, type SendCommandRequest } from "./api.ts";
import { commandRegistry } from "./command-registry.ts";
import { syncStore } from "./sync-store.ts";

export interface ExecuteCommandInput {
  streamId: string;
  streamType: string;
  type: string;
  payload: Record<string, unknown>;
  tenantId: string;
  principalId: string;
}

export type ExecuteCommandResult = { ok: true } | { ok: false; error: string; reason?: string };

export async function executeCommand(input: ExecuteCommandInput): Promise<ExecuteCommandResult> {
  const { streamId, streamType, type, payload, tenantId, principalId } = input;

  const model = getModel(streamId, streamType);
  if (!model) {
    return { ok: false, error: "unknown_stream", reason: `No model for ${streamType}:${streamId}` };
  }

  const config = AGGREGATE_REGISTRY[streamType];
  if (!config) {
    return { ok: false, error: "unknown_stream_type" };
  }

  const commandId = crypto.randomUUID();
  const expectedVersion = model.version;

  const command = {
    commandId,
    correlationId: commandId,
    causationId: commandId,
    streamId,
    streamType,
    type,
    payload,
    expectedVersion,
    actualTime: new Date(),
    tenantId,
    actingPrincipalId: principalId,
    effectivePrincipalId: null,
  };

  // Run the handler locally to produce speculative events
  const localResult = commandRegistry.handle(model.state, command, config);
  if (!localResult.ok) {
    return { ok: false, error: "command_rejected", reason: localResult.reason };
  }

  // Apply speculative events optimistically
  const speculativeEvents = [...localResult.events];
  if (speculativeEvents.length > 0) {
    syncStore.dispatch(commandId, streamId, streamType, speculativeEvents);
  }

  // Send to server
  const request: SendCommandRequest = {
    commandId,
    correlationId: commandId,
    causationId: commandId,
    streamId,
    streamType,
    type,
    payload,
    expectedVersion,
  };

  const response = await sendCommand(request);

  if (!response.ok) {
    if (speculativeEvents.length > 0) {
      syncStore.rejectCommand(commandId);
    }
    return { ok: false, error: response.error, reason: response.reason };
  }

  // Convert server events to DomainEvent (parse actualTime)
  const authoritativeEvents: DomainEvent[] = response.events.map((e) => ({
    ...e,
    actualTime: new Date(e.actualTime),
  }));

  if (speculativeEvents.length > 0) {
    syncStore.confirmCommand(commandId, authoritativeEvents);
  }

  return { ok: true };
}

function getModel(
  streamId: string,
  streamType: string,
): { version: number; state: unknown } | undefined {
  switch (streamType) {
    case "ProductType":
      return syncStore.productTypes.get(streamId);
    case "InventoryItem":
      return syncStore.inventoryItems.get(streamId);
    case "Room":
      return syncStore.rooms.get(streamId);
    case "Tenant":
      return syncStore.tenants.get(streamId);
    case "User":
      return syncStore.users.get(streamId);
    default:
      return undefined;
  }
}
