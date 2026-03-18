import { autorun } from "mobx";
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@heim/domain";
import { Model } from "./model.ts";

interface CounterState {
  readonly count: number;
}

interface CounterEvent extends DomainEvent {
  readonly eventType: "Incremented" | "Decremented";
}

class TestModel extends Model<CounterState, CounterEvent> {
  protected override fold(state: CounterState, event: CounterEvent): CounterState {
    switch (event.eventType) {
      case "Incremented":
        return { count: state.count + 1 };
      case "Decremented":
        return { count: state.count - 1 };
    }
  }
}

function makeEvent(overrides?: Partial<CounterEvent>): CounterEvent {
  return {
    id: "evt-1",
    tenantId: "tenant-1",
    streamId: "counter-1",
    streamType: "Counter",
    streamPosition: 1,
    eventType: "Incremented",
    correlationId: "corr-1",
    causationId: "caus-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    payload: {},
    metadata: {},
    actualTime: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

describe("Model", () => {
  it("initializes with streamId, streamType, state, and default version", () => {
    const model = new TestModel("counter-1", "Counter", { count: 0 });

    expect(model.streamId).toBe("counter-1");
    expect(model.streamType).toBe("Counter");
    expect(model.state).toEqual({ count: 0 });
    expect(model.version).toBe(0);
  });

  it("accepts a custom initial version", () => {
    const model = new TestModel("counter-1", "Counter", { count: 5 }, 3);

    expect(model.state).toEqual({ count: 5 });
    expect(model.version).toBe(3);
  });

  it("applies an event via fold and updates state and version", () => {
    const model = new TestModel("counter-1", "Counter", { count: 0 });

    model.applyEvent(makeEvent({ streamPosition: 1 }));

    expect(model.state).toEqual({ count: 1 });
    expect(model.version).toBe(1);
  });

  it("accumulates multiple sequential events", () => {
    const model = new TestModel("counter-1", "Counter", { count: 0 });

    model.applyEvent(makeEvent({ streamPosition: 1, eventType: "Incremented" }));
    model.applyEvent(makeEvent({ streamPosition: 2, eventType: "Incremented" }));
    model.applyEvent(makeEvent({ streamPosition: 3, eventType: "Decremented" }));

    expect(model.state).toEqual({ count: 1 });
    expect(model.version).toBe(3);
  });

  it("triggers MobX reactions when state changes", () => {
    const model = new TestModel("counter-1", "Counter", { count: 0 });
    const observed: CounterState[] = [];

    autorun(() => {
      observed.push(model.state);
    });

    model.applyEvent(makeEvent({ streamPosition: 1 }));
    model.applyEvent(makeEvent({ streamPosition: 2 }));

    expect(observed).toEqual([{ count: 0 }, { count: 1 }, { count: 2 }]);
  });
});
