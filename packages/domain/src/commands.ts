import { v7 as uuidv7 } from "uuid";
import type { AggregateConfig } from "./aggregate-registry.ts";
import type { DomainEvent } from "./events.ts";

const MAX_FOLLOW_UP_DEPTH = 10;

export interface Command {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly streamId: string;
  readonly streamType: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly expectedVersion: number;
  readonly actualTime: Date;
  readonly tenantId: string;
  readonly actingPrincipalId: string;
  readonly effectivePrincipalId: string | null;
}

export interface DecisionEvent<
  TEventType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventType: TEventType;
  readonly payload: TPayload;
}

export interface FollowUpIntent {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type DecisionResult =
  | {
      readonly ok: true;
      readonly events: readonly DecisionEvent[];
      readonly followUps?: readonly FollowUpIntent[];
    }
  | { readonly ok: false; readonly reason: string };

export type CommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly reason: string };

export interface CommandHandler<TState = unknown> {
  readonly streamType: string;
  handle(state: TState, command: Command): DecisionResult;
}

export class CommandHandlerRegistry {
  #handlers = new Map<string, CommandHandler>();

  register(handler: CommandHandler): this {
    if (this.#handlers.has(handler.streamType)) {
      throw new Error(`Handler already registered for stream type: ${handler.streamType}`);
    }
    this.#handlers.set(handler.streamType, handler);
    return this;
  }

  handle(state: unknown, command: Command, aggregateConfig: AggregateConfig): CommandResult {
    const baseVersion = command.expectedVersion;
    const allEvents: DomainEvent[] = [];
    const pending: Command[] = [command];
    let currentState = state;
    let iterations = 0;

    while (pending.length > 0) {
      if (iterations >= MAX_FOLLOW_UP_DEPTH) {
        return {
          ok: false,
          reason: `Follow-up command depth exceeded (max ${MAX_FOLLOW_UP_DEPTH})`,
        };
      }

      const cmd = pending.shift()!;
      const handler = this.#handlers.get(cmd.streamType);
      if (!handler) {
        return { ok: false, reason: `No handler for stream type: ${cmd.streamType}` };
      }

      const result = handler.handle(currentState, cmd);
      if (!result.ok) return result;

      for (const decision of result.events) {
        const domainEvent: DomainEvent = {
          id: uuidv7(),
          tenantId: cmd.tenantId,
          streamId: cmd.streamId,
          streamType: cmd.streamType,
          streamPosition: baseVersion + allEvents.length + 1,
          eventType: decision.eventType,
          correlationId: cmd.correlationId,
          causationId: `command:${cmd.commandId}`,
          actingPrincipalId: cmd.actingPrincipalId,
          effectivePrincipalId: cmd.effectivePrincipalId,
          payload: decision.payload,
          metadata: {},
          actualTime: cmd.actualTime,
        };
        allEvents.push(domainEvent);
        currentState = aggregateConfig.apply(currentState, domainEvent);
      }

      if (result.followUps) {
        for (const intent of result.followUps) {
          const lastEvent = allEvents[allEvents.length - 1]!;
          pending.push({
            commandId: uuidv7(),
            correlationId: cmd.correlationId,
            causationId: `event:${lastEvent.id}`,
            streamId: cmd.streamId,
            streamType: cmd.streamType,
            type: intent.type,
            payload: intent.payload,
            expectedVersion: baseVersion + allEvents.length,
            actualTime: cmd.actualTime,
            tenantId: cmd.tenantId,
            actingPrincipalId: cmd.actingPrincipalId,
            effectivePrincipalId: cmd.effectivePrincipalId,
          });
        }
      }

      iterations++;
    }

    return { ok: true, events: allEvents };
  }
}
