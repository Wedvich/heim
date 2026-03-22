import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type { MemberAddedEvent, MemberRemovedEvent, TenantCreatedEvent } from "../events.ts";
import { applyTenantEvent } from "./tenant-fold.ts";
import { INITIAL_TENANT_STATE } from "./tenant-state.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "tenant-1",
  streamType: "Tenant" as const,
  correlationId: "corr-1",
  causationId: "caus-1",
  actingPrincipalId: "principal-1",
  effectivePrincipalId: null,
  metadata: {},
};

function makeTenantCreatedEvent(overrides?: Partial<TenantCreatedEvent>): TenantCreatedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-1",
    streamPosition: 1,
    eventType: "TenantCreated",
    payload: {
      name: "Acme",
      slug: "acme",
      createdByPrincipalId: "principal-1",
    },
    actualTime: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

function makeMemberAddedEvent(overrides?: Partial<MemberAddedEvent>): MemberAddedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-2",
    streamPosition: 2,
    eventType: "MemberAdded",
    payload: {
      principalId: "principal-1",
      role: "owner",
    },
    actualTime: new Date("2026-01-15T10:01:00Z"),
    ...overrides,
  };
}

function makeMemberRemovedEvent(overrides?: Partial<MemberRemovedEvent>): MemberRemovedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "MemberRemoved",
    payload: {
      principalId: "principal-1",
    },
    actualTime: new Date("2026-01-15T10:02:00Z"),
    ...overrides,
  };
}

describe("applyTenantEvent", () => {
  it("applies TenantCreated", () => {
    const event = makeTenantCreatedEvent();
    const state = applyTenantEvent(INITIAL_TENANT_STATE, event);

    expect(state.tenantId).toBe("tenant-1");
    expect(state.name).toBe("Acme");
    expect(state.slug).toBe("acme");
    expect(state.createdAt).toEqual(new Date("2026-01-15T10:00:00Z"));
    expect(state.members).toEqual({});
  });

  it("applies MemberAdded", () => {
    const state = applyTenantEvent(INITIAL_TENANT_STATE, makeMemberAddedEvent());

    expect(Object.keys(state.members)).toHaveLength(1);
    expect(state.members["principal-1"]).toEqual({
      role: "owner",
      joinedAt: new Date("2026-01-15T10:01:00Z"),
    });
  });

  it("accumulates multiple MemberAdded events", () => {
    let state = applyTenantEvent(INITIAL_TENANT_STATE, makeMemberAddedEvent());
    state = applyTenantEvent(
      state,
      makeMemberAddedEvent({
        id: "evt-3",
        streamPosition: 3,
        payload: { principalId: "principal-2", role: "member" },
        actualTime: new Date("2026-01-15T10:05:00Z"),
      }),
    );

    expect(Object.keys(state.members)).toHaveLength(2);
    expect(state.members["principal-1"]!.role).toBe("owner");
    expect(state.members["principal-2"]!.role).toBe("member");
  });

  it("applies MemberRemoved", () => {
    let state = applyTenantEvent(INITIAL_TENANT_STATE, makeMemberAddedEvent());
    state = applyTenantEvent(state, makeMemberRemovedEvent());

    expect(Object.keys(state.members)).toHaveLength(0);
  });
});

describe("buildAggregate (Tenant)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_TENANT_STATE, [], applyTenantEvent);

    expect(aggregate.state).toEqual(INITIAL_TENANT_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("builds aggregate from events", () => {
    const event = makeTenantCreatedEvent();
    const aggregate = buildAggregate(INITIAL_TENANT_STATE, [event], applyTenantEvent);

    expect(aggregate.state.tenantId).toBe("tenant-1");
    expect(aggregate.state.name).toBe("Acme");
    expect(aggregate.state.slug).toBe("acme");
    expect(aggregate.version).toBe(1);
  });

  it("full lifecycle: create → add member → remove member", () => {
    const events = [makeTenantCreatedEvent(), makeMemberAddedEvent(), makeMemberRemovedEvent()];
    const aggregate = buildAggregate(INITIAL_TENANT_STATE, events, applyTenantEvent);

    expect(aggregate.state.tenantId).toBe("tenant-1");
    expect(Object.keys(aggregate.state.members)).toHaveLength(0);
    expect(aggregate.version).toBe(3);
  });
});
