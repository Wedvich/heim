import { describe, expect, it } from "vitest";
import type { MemberAddedEvent, MemberRemovedEvent, TenantCreatedEvent } from "@heim/domain";
import { TenantModel } from "./tenant-model.ts";

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
    payload: { principalId: "principal-1", role: "owner" },
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
    payload: { principalId: "principal-1" },
    actualTime: new Date("2026-01-15T10:02:00Z"),
    ...overrides,
  };
}

describe("TenantModel", () => {
  it("defaults to initial tenant state with version 0", () => {
    const model = new TenantModel("tenant-1");

    expect(model.streamId).toBe("tenant-1");
    expect(model.streamType).toBe("Tenant");
    expect(model.state.tenantId).toBeNull();
    expect(model.members).toEqual({});
    expect(model.version).toBe(0);
  });

  it("folds TenantCreated event and exposes computed getters", () => {
    const model = new TenantModel("tenant-1");

    model.applyEvent(makeTenantCreatedEvent());

    expect(model.name).toBe("Acme");
    expect(model.slug).toBe("acme");
    expect(model.state.tenantId).toBe("tenant-1");
    expect(model.version).toBe(1);
  });

  it("folds MemberAdded and exposes members", () => {
    const model = new TenantModel("tenant-1");
    model.applyEvent(makeTenantCreatedEvent());
    model.applyEvent(makeMemberAddedEvent());

    expect(Object.keys(model.members)).toHaveLength(1);
    expect(model.members["principal-1"]).toEqual({
      role: "owner",
      joinedAt: new Date("2026-01-15T10:01:00Z"),
    });
    expect(model.version).toBe(2);
  });

  it("folds MemberRemoved and removes member", () => {
    const model = new TenantModel("tenant-1");
    model.applyEvent(makeTenantCreatedEvent());
    model.applyEvent(makeMemberAddedEvent());
    model.applyEvent(makeMemberRemovedEvent());

    expect(Object.keys(model.members)).toHaveLength(0);
    expect(model.version).toBe(3);
  });
});
