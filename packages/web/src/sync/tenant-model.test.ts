import { describe, expect, it } from "vitest";
import type { TenantCreatedEvent } from "@heim/domain";
import { TenantModel } from "./tenant-model.ts";

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

describe("TenantModel", () => {
  it("defaults to initial tenant state with version 0", () => {
    const model = new TenantModel("tenant-1");

    expect(model.streamId).toBe("tenant-1");
    expect(model.streamType).toBe("Tenant");
    expect(model.state.tenantId).toBeNull();
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
});
