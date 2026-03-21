import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type { HydratedUserCreatedEvent } from "../hydrated-events.ts";
import { applyUserEvent } from "./user-fold.ts";
import { INITIAL_USER_STATE } from "./user-state.ts";

function makeUserCreatedEvent(
  overrides?: Partial<HydratedUserCreatedEvent>,
): HydratedUserCreatedEvent {
  return {
    id: "evt-1",
    tenantId: "tenant-1",
    streamId: "principal-1",
    streamType: "User",
    streamPosition: 1,
    eventType: "UserCreated",
    correlationId: "corr-1",
    causationId: "caus-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    payload: {
      provider: "google",
      providerSubjectId: "google-sub-123",
      merged: false,
    },
    metadata: {},
    actualTime: new Date("2026-01-15T10:00:00Z"),
    pii: {
      name: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://example.com/alice.jpg",
    },
    ...overrides,
  };
}

describe("applyUserEvent", () => {
  it("applies UserCreated with PII", () => {
    const event = makeUserCreatedEvent();
    const state = applyUserEvent(INITIAL_USER_STATE, event);

    expect(state).toEqual({
      principalId: "principal-1",
      createdAt: new Date("2026-01-15T10:00:00Z"),
      provider: "google",
      displayName: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://example.com/alice.jpg",
    });
  });

  it("degrades gracefully when PII is undefined (crypto shredded)", () => {
    const event = makeUserCreatedEvent({ pii: undefined });
    const state = applyUserEvent(INITIAL_USER_STATE, event);

    expect(state).toEqual({
      principalId: "principal-1",
      createdAt: new Date("2026-01-15T10:00:00Z"),
      provider: "google",
      displayName: undefined,
      email: undefined,
      avatarUrl: undefined,
    });
  });

  it("degrades gracefully when PII fields are partially present", () => {
    const event = makeUserCreatedEvent({
      pii: { name: "Alice" },
    });
    const state = applyUserEvent(INITIAL_USER_STATE, event);

    expect(state.displayName).toBe("Alice");
    expect(state.email).toBeUndefined();
    expect(state.avatarUrl).toBeUndefined();
  });
});

describe("buildAggregate (User)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_USER_STATE, [], applyUserEvent);

    expect(aggregate.state).toEqual(INITIAL_USER_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("builds aggregate from events", () => {
    const event = makeUserCreatedEvent();
    const aggregate = buildAggregate(INITIAL_USER_STATE, [event], applyUserEvent);

    expect(aggregate.state.principalId).toBe("principal-1");
    expect(aggregate.state.displayName).toBe("Alice");
    expect(aggregate.version).toBe(1);
  });
});
