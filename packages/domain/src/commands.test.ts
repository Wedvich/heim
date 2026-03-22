import { describe, expect, it } from "vitest";
import type { Command, CommandHandler, CommandResult } from "./commands.ts";
import { CommandHandlerRegistry } from "./commands.ts";

function stubHandler(streamType: string, result: CommandResult): CommandHandler {
  return {
    streamType,
    handle: (_state: unknown, _command: Command): CommandResult => result,
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
    ...overrides,
  };
}

describe("CommandHandlerRegistry", () => {
  it("dispatches to the correct handler by streamType", () => {
    const events = [
      { eventType: "SomethingDone" },
    ] as unknown as readonly import("./events.ts").DomainEvent[];
    const registry = new CommandHandlerRegistry();
    registry.register(stubHandler("TestAggregate", { ok: true, events }));

    const result = registry.handle({}, makeCommand());

    expect(result).toEqual({ ok: true, events });
  });

  it("returns error for unregistered stream type", () => {
    const registry = new CommandHandlerRegistry();

    const result = registry.handle({}, makeCommand({ streamType: "Unknown" }));

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
      handle(s: unknown, c: Command): CommandResult {
        receivedState = s;
        receivedCommand = c;
        return { ok: true, events: [] };
      },
    };

    const registry = new CommandHandlerRegistry();
    registry.register(handler);
    registry.handle(state, command);

    expect(receivedState).toBe(state);
    expect(receivedCommand).toBe(command);
  });
});
