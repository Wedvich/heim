import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type { TenantCreatedEvent } from "../events.ts";
import { applyTenantEvent } from "./tenant-fold.ts";
import { INITIAL_TENANT_STATE } from "./tenant-state.ts";

function makeTenantCreatedEvent(overrides?: Partial<TenantCreatedEvent>): TenantCreatedEvent {
  return {
    id: "evt-1",
    tenantId: "tenant-1",
    streamId: "tenant-1",
    streamType: "Tenant",
    streamPosition: 1,
    eventType: "TenantCreated",
    correlationId: "corr-1",
    causationId: "caus-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    payload: {
      name: "Acme",
      slug: "acme",
      createdByPrincipalId: "principal-1",
    },
    metadata: {},
    actualTime: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

describe("applyTenantEvent", () => {
  it("applies TenantCreated", () => {
    const event = makeTenantCreatedEvent();
    const state = applyTenantEvent(INITIAL_TENANT_STATE, event);

    expect(state).toEqual({
      tenantId: "tenant-1",
      name: "Acme",
      slug: "acme",
      createdAt: new Date("2026-01-15T10:00:00Z"),
    });
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
});
