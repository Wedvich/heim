import { describe, expect, it } from "vitest";
import type { HydratedUserCreatedEvent } from "@heim/domain";
import { UserModel } from "./user-model.ts";

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
      name: "Alice Smith",
      email: "alice@example.com",
      avatarUrl: "https://example.com/alice.jpg",
    },
    ...overrides,
  };
}

describe("UserModel", () => {
  it("defaults to initial user state with version 0", () => {
    const model = new UserModel("principal-1");

    expect(model.streamId).toBe("principal-1");
    expect(model.streamType).toBe("User");
    expect(model.state.principalId).toBeNull();
    expect(model.version).toBe(0);
  });

  it("folds UserCreated event and exposes computed getters", () => {
    const model = new UserModel("principal-1");

    model.applyEvent(makeUserCreatedEvent());

    expect(model.displayName).toBe("Alice Smith");
    expect(model.email).toBe("alice@example.com");
    expect(model.avatarUrl).toBe("https://example.com/alice.jpg");
    expect(model.state.principalId).toBe("principal-1");
    expect(model.version).toBe(1);
  });

  it("degrades gracefully when PII is shredded", () => {
    const model = new UserModel("principal-1");

    model.applyEvent(makeUserCreatedEvent({ pii: undefined }));

    expect(model.displayName).toBeUndefined();
    expect(model.email).toBeUndefined();
    expect(model.avatarUrl).toBeUndefined();
    expect(model.state.principalId).toBe("principal-1");
  });
});
