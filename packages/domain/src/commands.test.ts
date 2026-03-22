import { describe, expect, it } from "vitest";
import type { AggregateConfig } from "./aggregate-registry.ts";
import type { Command, CommandHandler, DecisionResult } from "./commands.ts";
import { CommandHandlerRegistry } from "./commands.ts";
import type { DomainEvent } from "./events.ts";

const STUB_AGGREGATE_CONFIG: AggregateConfig = {
  initial: {},
  apply: (state: unknown, _event: DomainEvent) => state,
};

function stubHandler(streamType: string, result: DecisionResult): CommandHandler {
  return {
    streamType,
    handle: (_state: unknown, _command: Command): DecisionResult => result,
  };
}

function makeCommand(overrides?: Partial<Command>): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "corr-1",
    streamId: "stream-1",
    streamType: "TestAggregate",
    type: "DoSomething",
    payload: {},
    expectedVersion: 0,
    actualTime: new Date("2026-01-15T10:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

describe("CommandHandlerRegistry", () => {
  it("dispatches to the correct handler and stamps envelope", () => {
    const registry = new CommandHandlerRegistry();
    registry.register(
      stubHandler("TestAggregate", {
        ok: true,
        events: [{ eventType: "SomethingDone", payload: { value: 42 } }],
      }),
    );

    const result = registry.handle({}, makeCommand(), STUB_AGGREGATE_CONFIG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.events).toHaveLength(1);
    const event = result.events[0]!;
    expect(event.eventType).toBe("SomethingDone");
    expect(event.payload).toEqual({ value: 42 });
    expect(event.streamId).toBe("stream-1");
    expect(event.streamType).toBe("TestAggregate");
    expect(event.streamPosition).toBe(1);
    expect(event.tenantId).toBe("tenant-1");
    expect(event.correlationId).toBe("corr-1");
    expect(event.causationId).toBe("command:cmd-1");
    expect(event.actingPrincipalId).toBe("principal-1");
    expect(event.effectivePrincipalId).toBeNull();
    expect(event.metadata).toEqual({});
    expect(event.actualTime).toEqual(new Date("2026-01-15T10:00:00Z"));
    expect(event.id).toMatch(/^[0-9a-f-]+$/);
  });

  it("assigns sequential streamPosition to multiple events", () => {
    const registry = new CommandHandlerRegistry();
    registry.register(
      stubHandler("TestAggregate", {
        ok: true,
        events: [
          { eventType: "FirstDone", payload: {} },
          { eventType: "SecondDone", payload: {} },
        ],
      }),
    );

    const result = registry.handle({}, makeCommand({ expectedVersion: 5 }), STUB_AGGREGATE_CONFIG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[0]!.streamPosition).toBe(6);
    expect(result.events[1]!.streamPosition).toBe(7);
  });

  it("returns error for unregistered stream type", () => {
    const registry = new CommandHandlerRegistry();

    const result = registry.handle(
      {},
      makeCommand({ streamType: "Unknown" }),
      STUB_AGGREGATE_CONFIG,
    );

    expect(result).toEqual({
      ok: false,
      reason: "No handler for stream type: Unknown",
    });
  });

  it("throws on duplicate registration", () => {
    const registry = new CommandHandlerRegistry();
    registry.register(stubHandler("TestAggregate", { ok: true, events: [] }));

    expect(() => registry.register(stubHandler("TestAggregate", { ok: true, events: [] }))).toThrow(
      "Handler already registered for stream type: TestAggregate",
    );
  });

  it("supports fluent registration chaining", () => {
    const registry = new CommandHandlerRegistry();

    const returned = registry
      .register(stubHandler("A", { ok: true, events: [] }))
      .register(stubHandler("B", { ok: true, events: [] }));

    expect(returned).toBe(registry);
  });

  it("passes state and command through to the handler", () => {
    const state = { name: "test" };
    const command = makeCommand({ type: "SpecificAction" });
    let receivedState: unknown;
    let receivedCommand: Command | undefined;

    const handler: CommandHandler = {
      streamType: "TestAggregate",
      handle(s: unknown, c: Command): DecisionResult {
        receivedState = s;
        receivedCommand = c;
        return { ok: true, events: [] };
      },
    };

    const registry = new CommandHandlerRegistry();
    registry.register(handler);
    registry.handle(state, command, STUB_AGGREGATE_CONFIG);

    expect(receivedState).toBe(state);
    expect(receivedCommand).toBe(command);
  });

  describe("follow-up commands", () => {
    it("processes follow-up intents returned by a handler", () => {
      let callCount = 0;
      const handler: CommandHandler = {
        streamType: "TestAggregate",
        handle(_state: unknown, cmd: Command): DecisionResult {
          callCount++;
          if (cmd.type === "DoSomething") {
            return {
              ok: true,
              events: [{ eventType: "SomethingDone", payload: {} }],
              followUps: [{ type: "FollowUp", payload: {} }],
            };
          }
          return { ok: true, events: [{ eventType: "FollowUpDone", payload: {} }] };
        },
      };

      const registry = new CommandHandlerRegistry();
      registry.register(handler);

      const result = registry.handle({}, makeCommand(), STUB_AGGREGATE_CONFIG);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.eventType).toBe("SomethingDone");
      expect(result.events[1]!.eventType).toBe("FollowUpDone");
      expect(result.events[0]!.streamPosition).toBe(1);
      expect(result.events[1]!.streamPosition).toBe(2);
      expect(callCount).toBe(2);
    });

    it("sets causationId on follow-up command from last emitted event", () => {
      let followUpCausationId: string | undefined;
      const handler: CommandHandler = {
        streamType: "TestAggregate",
        handle(_state: unknown, cmd: Command): DecisionResult {
          if (cmd.type === "DoSomething") {
            return {
              ok: true,
              events: [{ eventType: "SomethingDone", payload: {} }],
              followUps: [{ type: "FollowUp", payload: {} }],
            };
          }
          followUpCausationId = cmd.causationId;
          return { ok: true, events: [{ eventType: "FollowUpDone", payload: {} }] };
        },
      };

      const registry = new CommandHandlerRegistry();
      registry.register(handler);

      const result = registry.handle({}, makeCommand(), STUB_AGGREGATE_CONFIG);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const firstEventId = result.events[0]!.id;
      expect(followUpCausationId).toBe(`event:${firstEventId}`);
      expect(result.events[1]!.causationId).toMatch(/^command:/);
    });

    it("folds events into state between follow-up commands", () => {
      const config: AggregateConfig = {
        initial: { value: 0 },
        apply: (state: unknown, event: DomainEvent) => ({
          ...(state as Record<string, unknown>),
          value: (event.payload as { value?: number }).value ?? (state as { value: number }).value,
        }),
      };

      let stateOnFollowUp: unknown;
      const handler: CommandHandler = {
        streamType: "TestAggregate",
        handle(state: unknown, cmd: Command): DecisionResult {
          if (cmd.type === "DoSomething") {
            return {
              ok: true,
              events: [{ eventType: "ValueSet", payload: { value: 1 } }],
              followUps: [{ type: "FollowUp", payload: {} }],
            };
          }
          stateOnFollowUp = state;
          return { ok: true, events: [{ eventType: "FollowUpDone", payload: {} }] };
        },
      };

      const registry = new CommandHandlerRegistry();
      registry.register(handler);
      registry.handle({ value: 0 }, makeCommand(), config);

      expect(stateOnFollowUp).toEqual({ value: 1 });
    });

    it("propagates failure from follow-up command", () => {
      const handler: CommandHandler = {
        streamType: "TestAggregate",
        handle(_state: unknown, cmd: Command): DecisionResult {
          if (cmd.type === "DoSomething") {
            return {
              ok: true,
              events: [{ eventType: "SomethingDone", payload: {} }],
              followUps: [{ type: "FollowUp", payload: {} }],
            };
          }
          return { ok: false, reason: "follow-up failed" };
        },
      };

      const registry = new CommandHandlerRegistry();
      registry.register(handler);

      const result = registry.handle({}, makeCommand(), STUB_AGGREGATE_CONFIG);

      expect(result).toEqual({ ok: false, reason: "follow-up failed" });
    });

    it("prevents infinite follow-up loops", () => {
      const handler: CommandHandler = {
        streamType: "TestAggregate",
        handle(): DecisionResult {
          return {
            ok: true,
            events: [{ eventType: "SomethingDone", payload: {} }],
            followUps: [{ type: "DoSomething", payload: {} }],
          };
        },
      };

      const registry = new CommandHandlerRegistry();
      registry.register(handler);

      const result = registry.handle({}, makeCommand(), STUB_AGGREGATE_CONFIG);

      expect(result).toEqual({ ok: false, reason: "Follow-up command depth exceeded (max 10)" });
    });
  });
});
